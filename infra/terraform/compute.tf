data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
  filter {
    name   = "architecture"
    values = ["x86_64"]
  }
}

resource "aws_eip" "lims" {
  domain = "vpc"
  tags   = { Name = "${local.name}-eip" }
}

locals {
  # The instance address the BROWSER will use to reach Keycloak/API. With a domain
  # set, front everything with Caddy/TLS; otherwise the EIP over HTTP for a demo.
  public_addr = var.domain_name != "" ? var.domain_name : aws_eip.lims.public_ip

  # user_data = a small interpolated header that exports the Terraform-known values,
  # followed by a STATIC bootstrap script (file() is not interpolated, so no $$ escaping).
  bootstrap_header = <<-EOT
    #!/bin/bash
    export AWS_REGION="${var.aws_region}"
    export ECR_APP="${aws_ecr_repository.this["core-service"].repository_url}"
    export ECR_FRONTEND="${aws_ecr_repository.this["frontend"].repository_url}"
    export APP_TAG="${var.app_image_tag}"
    export FRONTEND_TAG="${var.frontend_image_tag}"
    export DB_SECRET="${aws_secretsmanager_secret.db.name}"
    export MAIL_SECRET="${aws_secretsmanager_secret.mail.name}"
    export KC_SECRET="${aws_secretsmanager_secret.keycloak_admin.name}"
    export S3_BUCKET="${aws_s3_bucket.patient_docs.bucket}"
    export PUBLIC_ADDR="${local.public_addr}"
    export KEYCLOAK_REALM="lims-realm"
  EOT

  user_data = "${local.bootstrap_header}\n${file("${path.module}/bootstrap.sh")}"
}

resource "aws_instance" "lims" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data                   = local.user_data
  user_data_replace_on_change = true

  root_block_device {
    volume_size = var.ec2_volume_size_gb
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 only
  }

  # RDS must exist before the host boots so the bootstrap can read the DB secret.
  depends_on = [aws_db_instance.lims, aws_secretsmanager_secret_version.db]

  tags = { Name = "${local.name}-host" }
}

resource "aws_eip_association" "lims" {
  instance_id   = aws_instance.lims.id
  allocation_id = aws_eip.lims.id
}
