terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ─────────────────────────────────────────────────────────────────────────────
# Local tags (all 8 required tags per platform policy §14)
# ─────────────────────────────────────────────────────────────────────────────
locals {
  service_name = "deploy-hub"
  component    = "core"
  common_tags = {
    Environment = var.env
    Service     = local.service_name
    Component   = local.component
    Owner       = var.team_owner
    CostCenter  = var.cost_center
    ManagedBy   = "terraform"
    GitRepo     = var.git_repo_url
    CreatedAt   = "2026-05-21"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# VPC (naming: <env>-<service>-vpc)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-vpc"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# Internet Gateway
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-igw"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# Public Subnets (for ALB)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-public-subnet-${count.index + 1}"
      Type = "public"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# Private Subnets (for ECS tasks and RDS)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_subnet" "private" {
  count              = length(var.private_subnet_cidrs)
  vpc_id             = aws_vpc.main.id
  cidr_block         = var.private_subnet_cidrs[count.index]
  availability_zone  = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-private-subnet-${count.index + 1}"
      Type = "private"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# Elastic IPs and NAT Gateways (for private subnet internet access)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_eip" "nat" {
  count  = length(var.private_subnet_cidrs)
  domain = "vpc"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-eip-${count.index + 1}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  count         = length(var.private_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-nat-${count.index + 1}"
    }
  )

  depends_on = [aws_internet_gateway.main]
}

# ─────────────────────────────────────────────────────────────────────────────
# Route Tables
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.main.id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-public-rt"
    }
  )
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.private_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-private-rt-${count.index + 1}"
    }
  )
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ─────────────────────────────────────────────────────────────────────────────
# ECR Repository (naming: <env>-<service>-<component>)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_ecr_repository" "deploy_hub" {
  name                 = "${var.env}-${local.service_name}-api"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-ecr"
    }
  )
}

resource "aws_ecr_lifecycle_policy" "deploy_hub" {
  repository = aws_ecr_repository.deploy_hub.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images, expire others after 30 days"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
          tagPrefixList = []
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS Security Group (allow 5432 from VPC only, restricted to ECS SG later)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name_prefix = "${var.env}-${local.service_name}-rds-"
  description = "Security group for ${var.env} ${local.service_name} RDS"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    cidr_blocks     = [var.vpc_cidr]
    description     = "PostgreSQL from VPC (will be restricted to ECS SG)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-rds-sg"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS Subnet Group (private subnets only)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.env}-${local.service_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-db-subnet-group"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS Parameter Group (enforce SSL)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.env}-${local.service_name}-postgres15"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-postgres-params"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL Instance (encrypted, private subnet, SSL required)
# Naming: <env>-<service>-db (≤ 63 chars for RDS)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier              = "${var.env}-${local.service_name}-db"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_allocated_storage
  storage_encrypted       = true                                    # SEC-CONTROL: encryption at rest
  kms_key_id              = aws_kms_key.rds.arn
  multi_az                = var.env == "prod" ? true : false
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  parameter_group_name    = aws_db_parameter_group.main.name

  # Credentials
  db_name  = "deployhub"
  username = var.rds_master_username
  password = var.rds_master_password

  # Security
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.env}-${local.service_name}-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  publicly_accessible             = false                           # SEC-CONTROL: private subnet, no public IP
  enable_cloudwatch_logs_exports  = ["postgresql"]
  backup_retention_period         = var.env == "prod" ? 30 : 7
  copy_tags_to_snapshot           = true
  enable_iam_database_authentication = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-postgres"
    }
  )

  depends_on = [aws_db_subnet_group.main]
}

# ─────────────────────────────────────────────────────────────────────────────
# KMS Key for RDS Encryption
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_kms_key" "rds" {
  description             = "KMS key for ${var.env} ${local.service_name} RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-rds-key"
    }
  )
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.env}-${local.service_name}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# ─────────────────────────────────────────────────────────────────────────────
# Data source for availability zones
# ─────────────────────────────────────────────────────────────────────────────
data "aws_availability_zones" "available" {
  state = "available"
}

# ─────────────────────────────────────────────────────────────────────────────
# SSM Parameters for cross-module reference (no terraform_remote_state)
# Pattern: /infra/<service>/core/<env>/<output-name>
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_ssm_parameter" "vpc_id" {
  name        = "/infra/${local.service_name}/core/${var.env}/vpc_id"
  type        = "String"
  value       = aws_vpc.main.id
  description = "VPC ID for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "private_subnet_ids" {
  name        = "/infra/${local.service_name}/core/${var.env}/private_subnet_ids"
  type        = "String"
  value       = join(",", aws_subnet.private[*].id)
  description = "Private subnet IDs for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "public_subnet_ids" {
  name        = "/infra/${local.service_name}/core/${var.env}/public_subnet_ids"
  type        = "String"
  value       = join(",", aws_subnet.public[*].id)
  description = "Public subnet IDs for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "ecr_repository_url" {
  name        = "/infra/${local.service_name}/core/${var.env}/ecr_repository_url"
  type        = "String"
  value       = aws_ecr_repository.deploy_hub.repository_url
  description = "ECR repository URL for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "/infra/${local.service_name}/core/${var.env}/rds_endpoint"
  type        = "String"
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "rds_port" {
  name        = "/infra/${local.service_name}/core/${var.env}/rds_port"
  type        = "String"
  value       = tostring(aws_db_instance.main.port)
  description = "RDS port for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "rds_database_name" {
  name        = "/infra/${local.service_name}/core/${var.env}/rds_database_name"
  type        = "String"
  value       = aws_db_instance.main.db_name
  description = "RDS database name for ${var.env} environment"

  tags = local.common_tags
}

resource "aws_ssm_parameter" "rds_security_group_id" {
  name        = "/infra/${local.service_name}/core/${var.env}/rds_security_group_id"
  type        = "String"
  value       = aws_security_group.rds.id
  description = "RDS security group ID for ${var.env} environment"

  tags = local.common_tags
}
