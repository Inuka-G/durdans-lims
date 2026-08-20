#!/usr/bin/env bash
# Pull the lims-agent client secret out of Keycloak into /opt/lims/.env as
# AGENT_CLIENT_SECRET and restart the WhatsApp agent to pick it up.
#
# WHY this exists: the realm import deliberately ships no secret for lims-agent, so
# Keycloak generates a fresh one on every import — which means every new host (and
# every realm re-import) mints a value only Keycloak knows. This moves it into the
# agent's environment without the value ever passing through a human, a terminal
# scrollback or an AWS secret that would go stale on the next import anyway.
#
# Lives in S3 rather than inline in user_data because EC2 caps user_data at 16 KB.

set -Eeuo pipefail
cd /opt/lims

kc_pw="$(sed -n 's/^KEYCLOAK_ADMIN_PASSWORD=//p' .env | tail -n 1)"

kcadm() {
  docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@"
}

# The password reaches kcadm through the container environment, not argv on this
# host: `ps` on the host shows the exec command line, not the container's env.
docker compose exec -T -e KPW="${kc_pw}" keycloak sh -c \
  '/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user admin --password "$KPW"' \
  >/dev/null

client_id="$(kcadm get clients -r lims-realm -q clientId=lims-agent --fields id --format csv --noquotes)"
if [[ -z "${client_id}" ]]; then
  echo "lims-agent client not found in lims-realm" >&2
  exit 1
fi

secret="$(kcadm get "clients/${client_id}/client-secret" -r lims-realm 2>/dev/null | grep -o '"value" *: *"[^"]*"' | sed 's/.*: *"//; s/"$//')"
if [[ -z "${secret}" || "${secret}" == "**********" ]]; then
  # No secret yet (or masked placeholder): mint one, then read it back.
  kcadm create "clients/${client_id}/client-secret" -r lims-realm >/dev/null
  secret="$(kcadm get "clients/${client_id}/client-secret" -r lims-realm | grep -o '"value" *: *"[^"]*"' | sed 's/.*: *"//; s/"$//')"
fi
if [[ -z "${secret}" ]]; then
  echo "could not read a client secret for lims-agent" >&2
  exit 1
fi

# Same upsert posture as refresh-meta.sh: passed via the environment, written by
# Python so no character in the secret can be misread as a sed escape.
AGENT_SECRET="${secret}" python3 <<'PY'
import io, os, re

line = "AGENT_CLIENT_SECRET=" + os.environ["AGENT_SECRET"]
env = io.open(".env", encoding="utf-8").read()
pattern = "^AGENT_CLIENT_SECRET=.*$"
if re.search(pattern, env, re.M):
    env = re.sub(pattern, lambda _m: line, env, count=1, flags=re.M)
else:
    env = env.rstrip("\n") + "\n" + line + "\n"
io.open(".env", "w", encoding="utf-8").write(env)
print("AGENT_CLIENT_SECRET refreshed in .env")
PY

docker compose up -d --no-deps whatsapp
echo "whatsapp restarted with the agent service-account secret"
