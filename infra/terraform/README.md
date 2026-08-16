# Durdans LIMS — AWS infrastructure (Terraform)

Provisions a cost-controlled **single-EC2 + managed RDS + S3** demo target. It
is sized to run the full Java, Next.js, Keycloak and Kafka stack reliably while
remaining inside the configured US$60 monthly budget.

## What it creates

| Resource | Detail | ~ /mo |
|---|---|---|
| VPC + 1 public + 2 private subnets, IGW | no NAT gateway (the big saver) | $0 |
| EC2 `t3.medium` + Elastic IP + 30 GB gp3 (encrypted) | runs Docker Compose with 2 GB swap | variable |
| RDS `db.t4g.micro` Postgres 15, 20 GB gp3 | encrypted, **7-day PITR backups**, private | ~$14 |
| S3 bucket | patient docs, SSE-S3, versioned, public-access-blocked | ~$0.50 |
| ECR x2 (`core-service`, `frontend`) | scan-on-push, keep-last-10 | ~$0.20 |
| Secrets Manager x3 (db / mail / keycloak) | generated passwords | ~$1.20 |
| IAM instance role | least-privilege: ECR pull, this bucket, these secrets, SSM | $0 |
| AWS Budget | alert at 80% / 100% when `alert_email` is set | $0 |

The host bootstraps itself (`bootstrap.sh`): installs Docker, logs in to ECR,
reads the secrets, and runs the app + frontend + Keycloak + Kafka via compose,
with the **app DB on RDS** and **patient docs on real S3 (instance role, no static
keys)**.

## Prerequisites

- Terraform ≥ 1.6, AWS CLI configured with credentials that can create the above.
- Images pushed to ECR by `.github/workflows/core-service-release.yml` and
  `.github/workflows/frontend.yml`. The first apply safely starts the base
  services while the ECR repositories are still empty.

## Remote state (do once, recommended)

```bash
terraform init -reconfigure \
  -backend-config="bucket=<globally-unique-state-bucket>" \
  -backend-config="key=demo/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="encrypt=true" \
  -backend-config="use_lockfile=true"
```

## Apply

```bash
cp terraform.tfvars.example terraform.tfvars   # set alert_email at minimum
terraform init
terraform plan
terraform apply
```

Outputs give you `frontend_url`, `api_url`, `keycloak_url`, the two `ecr_*_repo`
URLs (for CI), and `ssm_session_command` (shell onto the host — no SSH).

## After apply

1. Set the real mail credentials: update the `…/mail` secret in Secrets Manager.
2. Set the GitHub Actions repository variables documented in
   `docs/DEPLOYMENT.md`, then merge/push to `main` to publish both images.
3. Browse `frontend_url`. Keycloak admin password is in the `…/keycloak-admin` secret.

## Cost hygiene

- `aws ec2 stop-instances --instance-ids <id>` when not demoing — **RDS keeps the
  data**, and a stopped instance costs only its EBS (~$2.40/mo).
- The Budget alarm emails at 80% and 100% only when `alert_email` is non-empty.

## Teardown

```bash
terraform destroy
```

(`skip_final_snapshot = true` and `deletion_protection = false` are demo defaults —
flip both for real production so a `destroy` can't nuke patient data.)

## The documented "production target" we deliberately do NOT run 24/7

This module is the **right-sized demo**. The promotion path a senior reviewer
expects, and that we would run for a real lab:

- **ECS Fargate** for app + frontend (2 tasks each, autoscaling) behind an **ALB**
  with TLS from ACM.
- **RDS Multi-AZ** with a standby + automated failover.
- **MSK or self-managed Kafka** on its own nodes; **ElastiCache** if caching grows.
- **Private subnets + NAT** for the tasks; WAF on the ALB.
- The same ECR images and the same Secrets Manager wiring — only the compute and
  availability tier change.

Shipping this plan alongside the cheaper running stack is the point: it shows the
production answer was understood and the cost trade-off was deliberate.
