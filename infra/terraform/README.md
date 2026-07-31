# Durdans LIMS — AWS infrastructure (Terraform)

Provisions the cost-optimized **single-EC2 + managed RDS + S3** target from
`docs/PRODUCTION-READINESS-ROADMAP.md` (§2). Budgeted at **≈ US$34/month** so the
~US$120 of credits lasts the full review window (~3.5 months).

## What it creates

| Resource | Detail | ~ /mo |
|---|---|---|
| VPC + 1 public + 2 private subnets, IGW | no NAT gateway (the big saver) | $0 |
| EC2 `t3.small` + Elastic IP + 30 GB gp3 (encrypted) | runs the docker-compose stack | ~$17 |
| RDS `db.t4g.micro` Postgres 15, 20 GB gp3 | encrypted, **7-day PITR backups**, private | ~$14 |
| S3 bucket | patient docs, SSE-S3, versioned, public-access-blocked | ~$0.50 |
| ECR x2 (`core-service`, `frontend`) | scan-on-push, keep-last-10 | ~$0.20 |
| Secrets Manager x3 (db / mail / keycloak) | generated passwords | ~$1.20 |
| IAM instance role | least-privilege: ECR pull, this bucket, these secrets, SSM | $0 |
| AWS Budget | email alert at 80% / 100% of the monthly target | $0 |

The host bootstraps itself (`bootstrap.sh`): installs Docker, logs in to ECR,
reads the secrets, and runs the app + frontend + Keycloak + Kafka via compose,
with the **app DB on RDS** and **patient docs on real S3 (instance role, no static
keys)**.

## Prerequisites

- Terraform ≥ 1.6, AWS CLI configured with credentials that can create the above.
- Images pushed to ECR (CI does this — see `.github/workflows/deploy.yml`). For a
  first manual apply you can let the stack come up and push images after; the app
  container will restart-loop until the image exists, then start.

## Remote state (do once, recommended)

```bash
aws s3 mb s3://durdans-lims-tfstate --region us-east-1
aws s3api put-bucket-versioning --bucket durdans-lims-tfstate \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name durdans-lims-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region us-east-1
# then uncomment the backend "s3" block in versions.tf and run: terraform init -migrate-state
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
2. Push images (CI, or manually `docker build` + `docker push` to the ECR URLs).
3. Browse `frontend_url`. Keycloak admin password is in the `…/keycloak-admin` secret.

## Cost hygiene

- `aws ec2 stop-instances --instance-ids <id>` when not demoing — **RDS keeps the
  data**, and a stopped instance costs only its EBS (~$2.40/mo).
- The Budget alarm emails you at 80% and 100% of `budget_monthly_usd`.

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
