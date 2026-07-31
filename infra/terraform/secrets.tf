# Generated, never hard-coded. RDS rejects '/', '@', '"', space — exclude them.
resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%^&*()-_=+[]{}"
}

resource "random_password" "keycloak_admin" {
  length           = 20
  special          = true
  override_special = "!#$%^&*()-_=+"
}

# --- DB credentials (consumed by the app via the instance role) ---
resource "aws_secretsmanager_secret" "db" {
  name                    = "${local.name}/db"
  description             = "LIMS application Postgres credentials"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
    host     = aws_db_instance.lims.address
    port     = aws_db_instance.lims.port
    dbname   = var.db_name
    url      = "jdbc:postgresql://${aws_db_instance.lims.endpoint}/${var.db_name}"
  })
}

# --- Outbound mail (fill in after apply; mail stays disabled while blank) ---
resource "aws_secretsmanager_secret" "mail" {
  name                    = "${local.name}/mail"
  description             = "SMTP username + app password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "mail" {
  secret_id     = aws_secretsmanager_secret.mail.id
  secret_string = jsonencode({ username = "", password = "" })
}

# --- Keycloak admin ---
resource "aws_secretsmanager_secret" "keycloak_admin" {
  name                    = "${local.name}/keycloak-admin"
  description             = "Keycloak bootstrap admin password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "keycloak_admin" {
  secret_id     = aws_secretsmanager_secret.keycloak_admin.id
  secret_string = jsonencode({ username = "admin", password = random_password.keycloak_admin.result })
}
