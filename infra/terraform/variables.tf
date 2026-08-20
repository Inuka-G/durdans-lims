variable "aws_region" {
  description = "AWS region. us-east-1 keeps cross-region transfer at zero."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  type    = string
  default = "durdans-lims"
}

variable "environment" {
  type    = string
  default = "demo"
}

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

# --- Compute (single EC2 host running the compose stack) ---
variable "ec2_instance_type" {
  description = "t3.medium (2 vCPU / 4 GB) gives Java, Keycloak, Kafka and Next.js enough memory for a stable demo."
  type        = string
  default     = "t3.medium"
}

variable "ec2_volume_size_gb" {
  type    = number
  default = 30
}

variable "ssh_ingress_cidr" {
  description = "If set (e.g. 203.0.113.4/32), opens SSH/22 to this CIDR only. Empty = no SSH; use SSM Session Manager."
  type        = string
  default     = ""
}

# --- Database (managed Postgres for the LIMS app data) ---
variable "rds_instance_class" {
  description = "db.t4g.micro = Graviton, ~20% cheaper than t3."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "rds_engine_version" {
  type    = string
  default = "15"
}

variable "db_name" {
  type    = string
  default = "durdans_lims_db"
}

variable "db_username" {
  type    = string
  default = "limsadmin"
}

variable "rds_backup_retention_days" {
  description = "7-day automated backups + PITR window."
  type        = number
  default     = 7
}

# --- DR knobs: safe demo defaults; flip to the commented prod value for production ---
variable "rds_multi_az" {
  description = "Synchronous standby in a 2nd AZ with automatic failover. true ≈ doubles DB cost."
  type        = bool
  default     = false # prod: true
}

variable "rds_deletion_protection" {
  description = "Block accidental RDS deletion."
  type        = bool
  default     = false # prod: true
}

variable "rds_skip_final_snapshot" {
  description = "Skip the final snapshot on destroy. false = a final snapshot is taken (data preserved)."
  type        = bool
  default     = true # prod: false
}

variable "backup_bucket_retention_days" {
  description = "Days to keep logical pg_dump backups in the S3 backups bucket before expiry."
  type        = number
  default     = 30
}

# --- Images (pushed by CI to ECR) ---
variable "app_image_tag" {
  type    = string
  default = "latest"
}

variable "frontend_image_tag" {
  type    = string
  default = "latest"
}

variable "whatsapp_image_tag" {
  description = "Image tag for lims-whatsapp-service. CI overwrites this on the host per deploy."
  type        = string
  default     = "latest"
}

# --- Optional TLS domain (Caddy auto-HTTPS). Empty = serve over HTTP on the EIP. ---
variable "domain_name" {
  type    = string
  default = ""
}

# --- CI/CD keyless deploy (GitHub Actions OIDC) ---
variable "github_org" {
  description = "GitHub org/user that owns the repos. Empty = skip the OIDC role (use static CI keys instead)."
  type        = string
  default     = ""
}

variable "github_repos" {
  description = "Repo names allowed to assume the deploy role (sub claim)."
  type        = list(string)
  default     = ["durdans-lims"]
}

variable "github_owner_id" {
  description = "Immutable GitHub owner ID included in current OIDC subject claims."
  type        = string
  default     = ""

  validation {
    condition     = var.github_owner_id == "" || can(regex("^[0-9]+$", var.github_owner_id))
    error_message = "github_owner_id must be empty or a numeric GitHub owner ID."
  }
}

variable "github_repo_ids" {
  description = "Map of repo name to immutable GitHub repo ID for OIDC subjects."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for id in values(var.github_repo_ids) : can(regex("^[0-9]+$", id))])
    error_message = "Every github_repo_ids value must be a numeric GitHub repository ID."
  }
}

variable "github_deploy_branch" {
  description = "Only this branch may assume the AWS deployment role."
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub OIDC provider. Set false if your account already has one."
  type        = bool
  default     = true
}

# --- Cost guardrails ---
variable "budget_monthly_usd" {
  type    = number
  default = 60
}

variable "alert_email" {
  description = "Email for budget + CloudWatch alarms. Empty = no notifications created."
  type        = string
  default     = ""
}
