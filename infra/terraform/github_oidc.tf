# Keyless CI/CD: GitHub Actions assumes this role via OIDC — no long-lived AWS keys
# stored in GitHub secrets. Only created when var.github_org is set.

locals {
  oidc_enabled = var.github_org != ""
  oidc_subjects = [
    for repo in var.github_repos : "repo:${var.github_org}/${repo}:*"
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  count           = local.oidc_enabled && var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = local.oidc_enabled && !var.create_github_oidc_provider ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  oidc_provider_arn = local.oidc_enabled ? (
    var.create_github_oidc_provider
    ? aws_iam_openid_connect_provider.github[0].arn
    : data.aws_iam_openid_connect_provider.github[0].arn
  ) : ""
}

data "aws_iam_policy_document" "gha_assume" {
  count = local.oidc_enabled ? 1 : 0
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.oidc_subjects
    }
  }
}

resource "aws_iam_role" "github_actions" {
  count              = local.oidc_enabled ? 1 : 0
  name               = "${local.name}-gha-deploy"
  assume_role_policy = data.aws_iam_policy_document.gha_assume[0].json
}

# Push images to ECR + trigger a rolling restart on the host via SSM (no SSH).
data "aws_iam_policy_document" "gha_perms" {
  count = local.oidc_enabled ? 1 : 0

  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart",
      "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer",
    ]
    resources = [for r in aws_ecr_repository.this : r.arn]
  }
  statement {
    sid       = "SsmDeploy"
    actions   = ["ssm:SendCommand", "ssm:GetCommandInvocation"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions" {
  count  = local.oidc_enabled ? 1 : 0
  name   = "${local.name}-gha-perms"
  role   = aws_iam_role.github_actions[0].id
  policy = data.aws_iam_policy_document.gha_perms[0].json
}

output "github_actions_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN GitHub secret/variable for keyless deploy."
  value       = local.oidc_enabled ? aws_iam_role.github_actions[0].arn : "(OIDC disabled — set var.github_org)"
}
