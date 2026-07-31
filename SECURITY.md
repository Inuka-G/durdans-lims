# Security Policy

## Reporting a vulnerability

Open a **private** security advisory on this repository
(Security → Advisories → *Report a vulnerability*), or contact the maintainer
directly. Do not open a public issue for a suspected vulnerability, and do not
include a live credential in the report.

## Rules for this repository

**Never commit a credential.** Not to a branch, not "temporarily", not in a
comment, and not in a script that exists to remove credentials. Once a value
reaches a remote it must be treated as compromised and rotated — deleting the
commit does not un-publish it.

Configuration is read from environment variables with non-secret defaults:

| Value | Environment variable | Local override |
| --- | --- | --- |
| Database | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` | `application-local.yml` |
| Mail (SMTP) | `MAIL_USERNAME`, `MAIL_PASSWORD` | same — mail is disabled if unset |
| Object storage | `AWS_ACCESS_KEY`, `AWS_SECRET_KEY` | same |
| Keycloak admin client | `KEYCLOAK_ADMIN_CLIENT_SECRET` | same |
| Compose stack | see `infra/.env.example` | `infra/.env` |

`application-*.yml` (under `src/main/resources`) and `infra/.env` are
git-ignored. `infra/.env.example` is tracked and must contain only placeholders.

**Never commit `.vscode/`.** A `tasks.json` with `"runOn": "folderOpen"`
executes on every contributor's machine the moment they open the repository, and
`"task.allowAutomaticTasks": true` in `settings.json` removes the confirmation
prompt. This project has been attacked through exactly that vector — see
[docs/SECURITY-INCIDENT-2026-07.md](docs/SECURITY-INCIDENT-2026-07.md).

**Never commit Keycloak realm exports.** They carry client secrets, realm
signing keys, and real user data including PII and password hashes. Import them
from a secret store at deploy time. `infra/.gitignore` blocks them; do not
override it with `git add -f`.

## Automated enforcement

`.github/workflows/security.yml` runs on every push and pull request,
independent of which paths changed:

| Check | What fails the build |
| --- | --- |
| gitleaks | any detected secret, in the tree or in history |
| no-autorun-tasks | a committed `.vscode/`, or any `folderOpen` / `allowAutomaticTasks` string |
| commit-hygiene | AI-tool attribution in commit metadata |

These are guardrails, not a substitute for review.

## Handling a leak

1. **Rotate first.** Change the value at the source system before touching git.
2. **Then remove it** from the working tree and open a pull request.
3. **Record it** in `docs/SECURITY-INCIDENT-2026-07.md` (or a new dated file):
   what leaked, when, which commits, when it was rotated, and by whom.
4. **Assume exposure** for the whole window between commit and rotation. If the
   repository was public during that window, assume the value was scraped.

Do not write a script that hard-codes the secret in order to find and replace
it. That is how a leak gets published twice.
