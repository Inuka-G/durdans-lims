#!/usr/bin/env bash
# Deploy one immutable application image on the EC2 compose host.
# Usage: deploy-service.sh <app|frontend> <image-tag>

set -Eeuo pipefail

SERVICE="${1:-}"
IMAGE_TAG="${2:-}"
LIMS_DIR="/opt/lims"
STATE_DIR="${LIMS_DIR}/.deploy-state"

case "${SERVICE}" in
  app)
    TAG_VARIABLE="APP_TAG"
    HEALTH_TIMEOUT_SECONDS=300
    ;;
  frontend)
    TAG_VARIABLE="FRONTEND_TAG"
    HEALTH_TIMEOUT_SECONDS=180
    ;;
  *)
    echo "Usage: $0 <app|frontend> <image-tag>" >&2
    exit 64
    ;;
esac

if [[ ! "${IMAGE_TAG}" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]]; then
  echo "Invalid container image tag: ${IMAGE_TAG}" >&2
  exit 64
fi

cd "${LIMS_DIR}"
mkdir -p "${STATE_DIR}"

current_tag="$(sed -n "s/^${TAG_VARIABLE}=//p" .env | tail -n 1)"
state_file="${STATE_DIR}/${SERVICE}.tag"
previous_tag=""
if [[ -s "${state_file}" ]]; then
  previous_tag="$(cat "${state_file}")"
elif [[ -n "${current_tag}" && "${current_tag}" != "latest" ]]; then
  previous_tag="${current_tag}"
fi

set_tag() {
  local tag="$1"
  sed -i "s/^${TAG_VARIABLE}=.*/${TAG_VARIABLE}=${tag}/" .env
}

# An ECR authorization token is valid for 12 hours. bootstrap.sh logs in once, at
# first boot, and nothing renewed it — so every deploy from about half a day after
# the host was built died on `docker compose pull` with "Your authorization token
# has expired", the image never landed, and CI reported a failed deploy for a build
# that was perfectly good. Re-authenticate on each deploy; the token is short-lived
# by design, so treat the login as part of the deploy rather than part of the boot.
ecr_login() {
  local region account
  region="$(sed -n 's/^AWS_REGION=//p' .env | tail -n 1)"
  region="${region:-us-east-1}"
  account="$(aws sts get-caller-identity --region "${region}" --query Account --output text)"

  aws ecr get-login-password --region "${region}" \
    | docker login --username AWS --password-stdin \
        "${account}.dkr.ecr.${region}.amazonaws.com"
}

wait_until_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  local container_id status

  while (( SECONDS < deadline )); do
    container_id="$(docker compose ps -q "${SERVICE}")"
    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
      case "${status}" in
        healthy)
          return 0
          ;;
        unhealthy|exited|dead)
          return 1
          ;;
      esac
    fi
    sleep 5
  done
  return 1
}

echo "Deploying ${SERVICE}:${IMAGE_TAG}"

if ! ecr_login; then
  echo "Could not authenticate to ECR; refusing to deploy ${SERVICE}:${IMAGE_TAG}" >&2
  exit 1
fi

set_tag "${IMAGE_TAG}"

if docker compose pull "${SERVICE}" \
  && docker compose up -d --no-deps "${SERVICE}" \
  && wait_until_healthy; then
  printf '%s\n' "${IMAGE_TAG}" > "${state_file}"
  docker image prune -f >/dev/null
  echo "Deployment healthy: ${SERVICE}:${IMAGE_TAG}"
  exit 0
fi

echo "Deployment failed health verification: ${SERVICE}:${IMAGE_TAG}" >&2
docker compose logs --tail=150 "${SERVICE}" >&2 || true

if [[ -n "${previous_tag}" && "${previous_tag}" != "${IMAGE_TAG}" ]]; then
  echo "Rolling ${SERVICE} back to ${previous_tag}" >&2
  set_tag "${previous_tag}"
  docker compose pull "${SERVICE}" >&2 || true
  docker compose up -d --no-deps "${SERVICE}" >&2 || true
  if wait_until_healthy; then
    echo "Rollback healthy: ${SERVICE}:${previous_tag}" >&2
  else
    echo "Rollback also failed health verification" >&2
    docker compose logs --tail=150 "${SERVICE}" >&2 || true
  fi
else
  set_tag "${current_tag:-latest}"
  docker compose stop "${SERVICE}" >&2 || true
  echo "No previously healthy immutable tag was available; stopped ${SERVICE}" >&2
fi

exit 1
