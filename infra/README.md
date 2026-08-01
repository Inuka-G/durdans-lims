# LIMS Infrastructure

This repository contains the core infrastructure required to run the locally hosted services for the Durdans Hospital LIMS project. This includes Keycloak for authentication and authorization, along with its backing PostgreSQL database.

## Prerequisites
- [Docker](https://www.docker.com/products/docker-desktop/) (and Docker Compose)

## Setup and Run

To get the infrastructure up and running for development:

1. Clone this repository:
   ```bash
   git clone https://github.com/durdans-hospital-lims/lims-infrastructure.git
   cd lims-infrastructure
   ```

2. Start the services using Docker Compose:
   ```bash
   docker compose up -d
   ```

**Services Started:**
- **Keycloak** (Port `8081`): Available at `http://localhost:8081`
- **PostgreSQL Database** (Port `5433`): Used by Keycloak.

### Keycloak Pre-Configured Data (Auto-Import)

`keycloak-imports/` is mounted into the container and Keycloak imports it on
startup, so the realm, clients, roles and demo users exist as soon as the stack
is up. No manual Keycloak setup.

The committed file is **`keycloak-imports/lims-dev-seed.json`** — a sanitized
seed, not an export. It deliberately contains no realm signing keys, no client
secrets and no real users; Keycloak regenerates its keys on import.

> **Never commit a real export.** `.gitignore` blocks `*realm*.json` in this
> directory for that reason — a live export carries the realm's private signing
> keys, client secrets, and every user's PII and password hash. The seed sits
> outside that pattern by having no "realm" in its filename, so the guard keeps
> working. See [../SECURITY.md](../SECURITY.md).

On AWS the same file is uploaded by Terraform
(`aws_s3_object.keycloak_realm_seed`) and pulled down by `bootstrap.sh`, because
EC2 user_data is capped at 16 KB and the realm is ~80 KB.

## Credentials

**All of these are local-development values.** They are published here on
purpose; none of them may be reused anywhere real.

Keycloak admin console — <http://localhost:8081>

| Username | Password |
| --- | --- |
| `admin` | `admin` |

Application logins — <http://localhost:3000>. Every demo user has the password
**`LimsDev#2026`**.

| Username | Role | Branch |
| --- | --- | --- |
| `superadmin` | SUPER_ADMIN | *(all)* |
| `branchadmin1` | BRANCH_ADMIN | BR001 |
| `frontdesk1` | FRONT_DESK | BR001 |
| `billing1` | BILLING_OFFICER | BR001 |
| `phlebotomist1` | PHLEBOTOMIST | BR001 |
| `reception1` | LAB_RECEPTIONIST | BR001 |
| `mlt1` | MLT | BR001 |
| `supervisor1` | LAB_SUPERVISOR | BR001 |
| `pathologist1` | PATHOLOGIST | BR001 |
| `dispatch1` | DISPATCH_OFFICER | BR001 |
| `mlt2` | MLT | COL-1 |

`mlt2` is in a different branch on purpose: sign in as `mlt1`, note a sample id,
then try to open it as `mlt2` and you should get a 404 rather than a 403 — the
tenant guard does not confirm that another branch's records exist.

PostgreSQL (Keycloak's own database)

| Username | Password | Database |
| --- | --- | --- |
| `keycloak` | `keycloak` | `keycloak` |

## Useful Commands

- View logs for Keycloak:
  ```bash
  docker logs -f lims-keycloak
  ```

- Stop the services:
  ```bash
  docker compose down
  ```

- Completely wipe data and start fresh (this will delete the database contents, use with caution if testing updates):
  ```bash
  docker compose down -v
  docker compose up -d
  ```
