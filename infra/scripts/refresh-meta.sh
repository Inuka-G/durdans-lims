#!/usr/bin/env bash
# Re-read the Meta credentials from Secrets Manager into /opt/lims/.env and restart
# the WhatsApp agent.
#
# WHY this exists: Terraform creates durdans-lims/meta empty on purpose and an
# operator fills it in afterwards, but .env is only written by bootstrap.sh, at boot.
# Without this, filling the secret in AWS does nothing on its own, and the only way to
# pick it up would be to replace the instance — which costs the Keycloak container
# database. That is a bad trade for a credential change. It is also how a rotated app
# secret gets applied.
#
# Lives in S3 rather than inline in user_data because EC2 caps user_data at 16 KB.

set -Eeuo pipefail
cd /opt/lims

region="$(sed -n 's/^AWS_REGION=//p' .env | tail -n 1)"
secret="$(sed -n 's/^META_SECRET=//p' .env | tail -n 1)"
if [[ -z "${secret}" ]]; then
  echo "META_SECRET is not recorded in .env; nothing to refresh from" >&2
  exit 1
fi

json="$(aws secretsmanager get-secret-value --region "${region}" \
          --secret-id "${secret}" --query SecretString --output text)"

# Passed through the environment rather than a pipe: `python3 <<` already uses stdin
# for the program itself.
META_JSON="${json}" python3 <<'PY'
import io, json, os, re

data = json.loads(os.environ["META_JSON"])
fields = {
    "META_APP_ID": "app_id",
    "META_APP_SECRET": "app_secret",
    "META_VERIFY_TOKEN": "verify_token",
    "META_PHONE_NUMBER_ID": "phone_number_id",
    "META_WABA_ID": "waba_id",
    "META_ACCESS_TOKEN": "access_token",
    # Rides in the same secret rather than its own: it is filled by the same operator
    # at the same moment, and one refresh script beats two that must both be remembered.
    "GEMINI_API_KEY": "gemini_api_key",
}

env = io.open(".env", encoding="utf-8").read()
for key, field in fields.items():
    line = key + "=" + str(data.get(field, ""))
    pattern = "^" + re.escape(key) + "=.*$"
    if re.search(pattern, env, re.M):
        # A lambda, not a replacement string: a backslash in a secret would otherwise
        # be read as an escape and silently corrupt the value, which would then fail
        # as an invalid signature on every webhook with nothing pointing at the cause.
        env = re.sub(pattern, lambda _m: line, env, count=1, flags=re.M)
    else:
        env = env.rstrip("\n") + "\n" + line + "\n"

io.open(".env", "w", encoding="utf-8").write(env)
print(f"refreshed {len(fields)} values in .env")
PY

docker compose up -d --no-deps whatsapp
echo "whatsapp restarted against the refreshed credentials"
