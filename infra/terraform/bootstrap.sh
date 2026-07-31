# =====================================================================
# Static EC2 bootstrap (appended to the Terraform-generated header that exports
# AWS_REGION, ECR_*, *_SECRET, S3_BUCKET, PUBLIC_ADDR, KEYCLOAK_REALM, *_TAG).
# Brings up the LIMS compose stack: app+frontend (from ECR) + Keycloak + Kafka,
# with the app DB on RDS and patient documents on real S3 (IAM instance role).
# =====================================================================
set -euxo pipefail

# --- Docker + compose plugin (Amazon Linux 2023) ---
dnf update -y
dnf install -y docker python3
systemctl enable --now docker
mkdir -p /usr/libexec/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64" \
  -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# --- Authenticate to ECR (instance role) ---
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# --- Pull secrets (instance role) ---
get_json() { aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$1" --query SecretString --output text; }
jq_field() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }

DB_JSON="$(get_json "$DB_SECRET")"
DB_URL="$(echo "$DB_JSON" | jq_field url)"
DB_USERNAME="$(echo "$DB_JSON" | jq_field username)"
DB_PASSWORD="$(echo "$DB_JSON" | jq_field password)"

MAIL_JSON="$(get_json "$MAIL_SECRET")"
MAIL_USERNAME="$(echo "$MAIL_JSON" | jq_field username)"
MAIL_PASSWORD="$(echo "$MAIL_JSON" | jq_field password)"

KC_JSON="$(get_json "$KC_SECRET")"
KC_ADMIN_PASSWORD="$(echo "$KC_JSON" | jq_field password)"

# --- Write the stack to /opt/lims ---
mkdir -p /opt/lims
cd /opt/lims

cat > .env <<ENVEOF
DB_URL=${DB_URL}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
MAIL_USERNAME=${MAIL_USERNAME}
MAIL_PASSWORD=${MAIL_PASSWORD}
KEYCLOAK_ADMIN_PASSWORD=${KC_ADMIN_PASSWORD}
KEYCLOAK_DB_PASSWORD=${KC_ADMIN_PASSWORD}
PUBLIC_ADDR=${PUBLIC_ADDR}
S3_BUCKET=${S3_BUCKET}
ECR_APP=${ECR_APP}
ECR_FRONTEND=${ECR_FRONTEND}
APP_TAG=${APP_TAG}
FRONTEND_TAG=${FRONTEND_TAG}
ENVEOF
chmod 600 .env

cat > docker-compose.yml <<'COMPOSE'
name: durdans-lims-prod
networks: { lims-net: { driver: bridge } }
volumes: { kc_db: {}, kafka_data: {} }

services:
  kc-db:
    image: postgres:15
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
    volumes: [ "kc_db:/var/lib/postgresql/data" ]
    networks: [lims-net]
    healthcheck: { test: ["CMD-SHELL","pg_isready -U keycloak"], interval: 10s, timeout: 5s, retries: 5 }
    restart: always

  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev --import-realm
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://kc-db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: ${KEYCLOAK_DB_PASSWORD}
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
      KC_HEALTH_ENABLED: "true"
      KC_HOSTNAME_STRICT: "false"
    ports: [ "8081:8080" ]
    networks: [lims-net]
    depends_on: { kc-db: { condition: service_healthy } }
    restart: always

  kafka:
    image: bitnami/kafka:3.7
    environment:
      KAFKA_CFG_NODE_ID: "1"
      KAFKA_CFG_PROCESS_ROLES: "broker,controller"
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: "1@kafka:9093"
      KAFKA_CFG_LISTENERS: "PLAINTEXT://:9092,CONTROLLER://:9093"
      KAFKA_CFG_ADVERTISED_LISTENERS: "PLAINTEXT://kafka:9092"
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT"
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: "CONTROLLER"
      ALLOW_PLAINTEXT_LISTENER: "yes"
    volumes: [ "kafka_data:/bitnami/kafka" ]
    networks: [lims-net]
    healthcheck: { test: ["CMD-SHELL","kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"], interval: 15s, timeout: 10s, retries: 10, start_period: 30s }
    restart: always

  app:
    image: ${ECR_APP}:${APP_TAG}
    environment:
      SPRING_PROFILES_ACTIVE: docker
      DB_URL: ${DB_URL}
      DB_USERNAME: ${DB_USERNAME}
      DB_PASSWORD: ${DB_PASSWORD}
      KEYCLOAK_REALM: lims-realm
      KEYCLOAK_INTERNAL_URL: http://keycloak:8080
      KEYCLOAK_PUBLIC_URL: http://${PUBLIC_ADDR}:8081
      # Real S3 via the instance role: blank endpoint + blank static keys.
      AWS_S3_ENDPOINT: ""
      AWS_ACCESS_KEY: ""
      AWS_SECRET_KEY: ""
      AWS_S3_BUCKET: ${S3_BUCKET}
      MAIL_USERNAME: ${MAIL_USERNAME}
      MAIL_PASSWORD: ${MAIL_PASSWORD}
    ports: [ "11000:11000" ]
    networks: [lims-net]
    depends_on: { kafka: { condition: service_healthy }, keycloak: { condition: service_started } }
    restart: always

  frontend:
    image: ${ECR_FRONTEND}:${FRONTEND_TAG}
    ports: [ "3000:3000" ]
    networks: [lims-net]
    depends_on: { app: { condition: service_started } }
    restart: always
COMPOSE

docker compose pull || true
docker compose up -d
echo "LIMS stack started. Frontend: http://${PUBLIC_ADDR}:3000  API: http://${PUBLIC_ADDR}:11000  Keycloak: http://${PUBLIC_ADDR}:8081"
