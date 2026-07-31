output "host_public_ip" {
  description = "Elastic IP of the LIMS host"
  value       = aws_eip.lims.public_ip
}

output "frontend_url" {
  value = "http://${local.public_addr}:3000"
}

output "api_url" {
  value = "http://${local.public_addr}:11000"
}

output "keycloak_url" {
  value = "http://${local.public_addr}:8081"
}

output "ecr_app_repo" {
  description = "Push the backend image here (CI does this)"
  value       = aws_ecr_repository.this["core-service"].repository_url
}

output "ecr_frontend_repo" {
  value = aws_ecr_repository.this["frontend"].repository_url
}

output "rds_endpoint" {
  value     = aws_db_instance.lims.endpoint
  sensitive = true
}

output "s3_bucket" {
  value = aws_s3_bucket.patient_docs.bucket
}

output "backups_bucket" {
  description = "Encrypted S3 bucket for logical pg_dump backups (set BACKUP_S3_BUCKET to this)"
  value       = aws_s3_bucket.backups.bucket
}

output "db_secret_name" {
  description = "Secrets Manager secret holding the DB credentials"
  value       = aws_secretsmanager_secret.db.name
}

output "ssm_session_command" {
  description = "Open a shell on the host without SSH"
  value       = "aws ssm start-session --target ${aws_instance.lims.id} --region ${var.aws_region}"
}
