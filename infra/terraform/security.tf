# --- EC2 security group ---
resource "aws_security_group" "ec2" {
  name        = "${local.name}-ec2-sg"
  description = "LIMS host: web + demo service ports"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP (Caddy / redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS (Caddy auto-TLS)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Direct demo ports (frontend / API / Keycloak). Convenient for a student demo
  # without a domain; for real prod, drop these and serve everything via 443/Caddy.
  dynamic "ingress" {
    for_each = var.domain_name == "" ? toset(["3000", "11000", "8081"]) : toset([])
    content {
      description = "demo port ${ingress.value}"
      from_port   = tonumber(ingress.value)
      to_port     = tonumber(ingress.value)
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # Optional SSH, only if a CIDR is supplied. Default path is SSM Session Manager.
  dynamic "ingress" {
    for_each = var.ssh_ingress_cidr == "" ? [] : [var.ssh_ingress_cidr]
    content {
      description = "SSH (restricted)"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-ec2-sg" }
}

# --- RDS security group: only the EC2 host may reach Postgres ---
resource "aws_security_group" "rds" {
  name        = "${local.name}-rds-sg"
  description = "Postgres reachable only from the LIMS host"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EC2 only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name}-rds-sg" }
}
