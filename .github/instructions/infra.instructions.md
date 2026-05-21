---
applyTo: "infra/**"
---

# Infrastructure — Engineering Rules

These rules apply to all Terraform code in `infra/`. They are non-negotiable without an ADR.
Derived from `platform-team/developer-guidelines.md`.

---

## Naming Schema

Every AWS resource: `<env>-<service>-<component>[-<qualifier>]`

| Segment | Rule | Examples |
|---|---|---|
| `<env>` | One of: `prod`, `stage`, `dev`, `sandbox` | `prod`, `dev` |
| `<service>` | kebab-case, ≤ 20 characters | `claims-api`, `billing-svc` |
| `<component>` | describes the resource type | `alb`, `db`, `cluster`, `sg` |

**Character limits (hard AWS limits):**
- ALB and Target Group names: ≤ 32 characters
- IAM role names: ≤ 64 characters
- RDS instance identifiers: ≤ 63 characters
- SQS queue names: ≤ 80 characters

**Valid examples:**
```
prod-claims-api-alb
dev-billing-svc-db
stage-auth-gateway-sg
```

**Invalid (will be rejected by tflint):**
```
claims-alb              ← missing env prefix
prod_claims_api         ← underscores not allowed
prod-claimsprocessing-api-alb  ← service segment > 20 chars
```

---

## Required AWS Tags

Every resource must carry all 8 tags. Apply via platform module — do not set ad-hoc:

```hcl
locals {
  required_tags = {
    Environment = var.environment        # prod | stage | dev | sandbox
    Service     = var.service_name       # kebab-case ≤ 20 chars
    Component   = var.component_name     # alb | db | ecs-service | etc.
    Owner       = var.team_owner         # team email or Slack channel
    CostCenter  = var.cost_center        # finance cost center code
    ManagedBy   = "terraform"            # always "terraform" for IaC-managed resources
    GitRepo     = var.git_repo_url       # full HTTPS URL to this repo
    CreatedAt   = timestamp()            # auto-set — do not hardcode a date
  }
}
```

Missing any of these 8 tags = blocker before `terraform apply`.

---

## Repository Topology

IaC lives in separate repos from application code.

```
<system>-core/            ← shared foundations (VPC, ECS cluster, ALB, IAM roles)
  main.tf
  outputs.tf              ← write outputs to SSM Parameter Store
  variables.tf

<system>-<component>/     ← workload-specific (ECS service, task definition, RDS)
  main.tf
  variables.tf
  data.tf                 ← read shared outputs from SSM Parameter Store
```

Examples:
- `claims-core` + `claims-api` + `claims-worker`
- `billing-core` + `billing-api`

---

## Cross-Repo Reference Pattern — SSM Parameter Store

**NEVER use `terraform_remote_state`** to share outputs between repos. Use SSM.

**In `-core` repo:** write outputs to SSM

```hcl
# Path pattern: /infra/<system>/core/<env>/<output-name>
resource "aws_ssm_parameter" "ecs_cluster_arn" {
  name  = "/infra/${var.service_name}/core/${var.environment}/ecs_cluster_arn"
  type  = "String"
  value = aws_ecs_cluster.main.arn
  tags  = local.required_tags
}

resource "aws_ssm_parameter" "alb_listener_arn" {
  name  = "/infra/${var.service_name}/core/${var.environment}/alb_listener_arn"
  type  = "String"
  value = aws_lb_listener.https.arn
  tags  = local.required_tags
}
```

**In `-component` repo:** read from SSM

```hcl
data "aws_ssm_parameter" "cluster_arn" {
  name = "/infra/${var.service_name}/core/${var.environment}/ecs_cluster_arn"
}

resource "aws_ecs_service" "api" {
  cluster = data.aws_ssm_parameter.cluster_arn.value
  # ...
}
```

---

## CI Pipeline Contract

| Trigger | Environment | Action | Approval |
|---|---|---|---|
| PR opened/updated | — | `terraform plan` | None (auto-comment on PR) |
| Merge to main | dev | `terraform apply` | None (automatic) |
| Manual trigger | stage | `terraform apply` | 1 approval required |
| Manual trigger | prod | `terraform apply` | 2 approvals required |

The single GitHub Actions runner uses OIDC federation (no long-lived AWS credentials):

```hcl
# IAM roles for OIDC
infra-readonly   ← used for plan (read-only, safe for PR)
infra-write      ← used for apply (scoped to specific resources)
```

---

## Container Image Tagging

Same image promoted across environments — never rebuild per environment:

```
<service>/<component>:<git-sha>-<env>
```

Examples:
- `claims-api/api:a3f1c2b-dev` → `claims-api/api:a3f1c2b-stage` → `claims-api/api:a3f1c2b-prod`

In ECS task definition Terraform:

```hcl
variable "image_tag" {
  description = "Container image tag — format: <service>/<component>:<git-sha>-<env>"
  type        = string
}

resource "aws_ecs_task_definition" "api" {
  container_definitions = jsonencode([{
    name  = "${var.service_name}-api"
    image = "${var.ecr_registry}/${var.image_tag}"
    # ...
  }])
}
```

---

## IaC Security Rules (tfsec/Checkov)

These rules are checked in CI and will fail the pipeline:

- S3 buckets: `server_side_encryption_configuration` required, `block_public_acls = true`
- RDS: `storage_encrypted = true`, `publicly_accessible = false`, `backup_retention_period ≥ 7`
- Security groups: no ingress rule with `cidr_blocks = ["0.0.0.0/0"]` on ports other than 80/443
- IAM policies: no `Resource = "*"` for sensitive actions (s3:DeleteObject, iam:*, etc.)
- Secrets: never in Terraform variables or tfvars — use SSM Parameter Store SecureString or
  Secrets Manager

---

## Terraform Style

```hcl
# Required: explicit provider version constraint
terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Required: remote state backend (never local)
backend "s3" {
  bucket         = "nasco-terraform-state"
  key            = "${var.service_name}/${var.environment}/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```
