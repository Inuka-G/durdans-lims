resource "random_id" "suffix" {
  byte_length = 3
}

# --- S3: patient documents (replaces LocalStack in the cloud) ---
resource "aws_s3_bucket" "patient_docs" {
  bucket = "${local.name}-patient-docs-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_versioning" "patient_docs" {
  bucket = aws_s3_bucket.patient_docs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "patient_docs" {
  bucket = aws_s3_bucket.patient_docs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "patient_docs" {
  bucket                  = aws_s3_bucket.patient_docs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# --- S3: encrypted, versioned backups bucket (logical pg_dump dumps; H5/DR) ---
resource "aws_s3_bucket" "backups" {
  bucket = "${local.name}-backups-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Expire old dumps. Keep this >= the RPO/retention promised in DISASTER-RECOVERY.md.
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id
  rule {
    id     = "expire-old-dumps"
    status = "Enabled"
    filter {}
    expiration {
      days = var.backup_bucket_retention_days
    }
    noncurrent_version_expiration {
      noncurrent_days = var.backup_bucket_retention_days
    }
  }
}

# --- ECR: one repo per image, scanned on push ---
resource "aws_ecr_repository" "this" {
  for_each             = toset(["core-service", "frontend"])
  name                 = "${var.project}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Keep only the last 10 images per repo so storage cost stays near zero.
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------------------
# Keycloak realm seed
#
# The EC2 host is bootstrapped from user_data, which is capped at 16 KB — the
# 80 KB realm JSON cannot be embedded there. Upload it to the bucket the
# instance role can already read (see the PatientDocsBucket statement in
# iam.tf) and have bootstrap.sh pull it down before `docker compose up`.
#
# This is the DEMO seed: it carries fixed development passwords and no real
# users. A production realm must be imported from Secrets Manager instead —
# see SECURITY.md.
# ---------------------------------------------------------------------------
locals {
  keycloak_realm_seed = jsonencode(merge(
    jsondecode(file("${path.module}/../keycloak-imports/lims-dev-seed.json")),
    {
      # An IP-only demo has no certificate yet. A domain-enabled replacement
      # returns to Keycloak's external-HTTPS requirement automatically.
      sslRequired = var.domain_name == "" ? "none" : "external"
    }
  ))
}

resource "aws_s3_object" "keycloak_realm_seed" {
  bucket  = aws_s3_bucket.patient_docs.id
  key     = "bootstrap/lims-dev-seed.json"
  content = local.keycloak_realm_seed
  etag    = md5(local.keycloak_realm_seed)

  # Prevents a stale realm from being served if the file changes but the
  # object is cached by the CLI.
  cache_control = "no-cache"
}

# The host fetches this immutable deployment helper during bootstrap. Keeping it
# in S3 avoids inflating EC2 user_data and gives CI one audited entry point for
# health verification and rollback.
resource "aws_s3_object" "deploy_service_script" {
  bucket = aws_s3_bucket.patient_docs.id
  key    = "bootstrap/deploy-service.sh"
  source = "${path.module}/../scripts/deploy-service.sh"
  etag   = filemd5("${path.module}/../scripts/deploy-service.sh")

  cache_control = "no-cache"
}
