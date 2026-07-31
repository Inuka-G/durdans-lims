resource "aws_db_subnet_group" "lims" {
  name       = "${local.name}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name}-db-subnets" }
}

resource "aws_db_instance" "lims" {
  identifier     = "${local.name}-db"
  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  allocated_storage = var.rds_allocated_storage_gb
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.lims.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = var.rds_multi_az # single-AZ for cost; flip the var for the prod standby

  # Backup / DR — the gap the audit flagged. PITR window + automated daily snapshot.
  # The DR flags are var-gated (see variables.tf) so prod hardens them without editing HCL.
  backup_retention_period    = var.rds_backup_retention_days
  backup_window              = "02:00-03:00"
  maintenance_window         = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot      = true
  deletion_protection        = var.rds_deletion_protection
  skip_final_snapshot        = var.rds_skip_final_snapshot
  final_snapshot_identifier  = var.rds_skip_final_snapshot ? null : "${local.name}-db-final"
  auto_minor_version_upgrade = true

  performance_insights_enabled = false # off to stay in free tier

  tags = { Name = "${local.name}-db" }
}
