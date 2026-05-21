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
  component    = "api"
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
# Read core infrastructure from SSM Parameter Store
# Pattern: /infra/<service>/core/<env>/<output-name>
# ─────────────────────────────────────────────────────────────────────────────
data "aws_ssm_parameter" "vpc_id" {
  name = "/infra/${local.service_name}/core/${var.env}/vpc_id"
}

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "/infra/${local.service_name}/core/${var.env}/private_subnet_ids"
}

data "aws_ssm_parameter" "public_subnet_ids" {
  name = "/infra/${local.service_name}/core/${var.env}/public_subnet_ids"
}

data "aws_ssm_parameter" "ecr_repository_url" {
  name = "/infra/${local.service_name}/core/${var.env}/ecr_repository_url"
}

data "aws_ssm_parameter" "rds_endpoint" {
  name = "/infra/${local.service_name}/core/${var.env}/rds_endpoint"
}

data "aws_ssm_parameter" "rds_port" {
  name = "/infra/${local.service_name}/core/${var.env}/rds_port"
}

data "aws_ssm_parameter" "rds_database_name" {
  name = "/infra/${local.service_name}/core/${var.env}/rds_database_name"
}

data "aws_ssm_parameter" "rds_security_group_id" {
  name = "/infra/${local.service_name}/core/${var.env}/rds_security_group_id"
}

# Parse SSM parameter strings
locals {
  vpc_id               = data.aws_ssm_parameter.vpc_id.value
  private_subnet_ids   = split(",", data.aws_ssm_parameter.private_subnet_ids.value)
  public_subnet_ids    = split(",", data.aws_ssm_parameter.public_subnet_ids.value)
  ecr_repository_url   = data.aws_ssm_parameter.ecr_repository_url.value
  rds_endpoint         = data.aws_ssm_parameter.rds_endpoint.value
  rds_security_group_id = data.aws_ssm_parameter.rds_security_group_id.value
}

# ─────────────────────────────────────────────────────────────────────────────
# Security Groups
# ─────────────────────────────────────────────────────────────────────────────

# ALB Security Group: Accept 443 only (HTTP redirects to HTTPS)
resource "aws_security_group" "alb" {
  name_prefix = "${var.env}-${local.service_name}-alb-"
  description = "ALB security group for ${var.env} ${local.service_name}"
  vpc_id      = local.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP (will redirect to HTTPS)"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
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
      Name = "${var.env}-${local.service_name}-alb-sg"
    }
  )
}

# ECS Security Group: No public inbound, allow from ALB
resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${var.env}-${local.service_name}-ecs-"
  description = "ECS tasks security group for ${var.env} ${local.service_name}"
  vpc_id      = local.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "Container port from ALB"
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
      Name = "${var.env}-${local.service_name}-ecs-sg"
    }
  )
}

# RDS Security Group Ingress: Allow from ECS tasks
resource "aws_security_group_rule" "rds_from_ecs" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = local.rds_security_group_id
  source_security_group_id = aws_security_group.ecs_tasks.id
  description              = "PostgreSQL from ECS tasks"
}

# ─────────────────────────────────────────────────────────────────────────────
# Application Load Balancer (naming: <env>-<service>-alb, ≤ 32 chars)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.env}-${local.service_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = local.public_subnet_ids

  enable_deletion_protection = var.env == "prod" ? true : false

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-alb"
    }
  )
}

# Target Group (naming: <env>-<service>-tg, ≤ 32 chars)
resource "aws_lb_target_group" "main" {
  name        = "${var.env}-${local.service_name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 3
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-tg"
    }
  )
}

# HTTPS Listener (TLS 1.2 minimum)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# HTTP Listener: Redirect to HTTPS
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# CloudWatch Log Group for ECS
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.env}-${local.service_name}"
  retention_in_days = var.env == "prod" ? 30 : 7

  tags = merge(
    local.common_tags,
    {
      Name = "/ecs/${var.env}-${local.service_name}"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# AWS Secrets Manager: Database connection string
# SEC-CONTROL: Credentials from Secrets Manager (not env vars)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_secretsmanager_secret" "database_url" {
  name_prefix             = "${var.env}-${local.service_name}-database-"
  recovery_window_in_days = 7

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-database-url"
    }
  )
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = jsonencode({
    DATABASE_URL = "postgres://postgres@${local.rds_endpoint}/${data.aws_ssm_parameter.rds_database_name.value}?sslmode=require"
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Cluster
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.env}-${local.service_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-cluster"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for ECS Task Execution (pull image, write logs, get secrets)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution_role" {
  name_prefix = "ecs-task-execution-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "ecs-task-execution-${var.env}-${local.service_name}"
    }
  )
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Add policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name_prefix = "ecs-task-secrets-${var.env}-"
  role        = aws_iam_role.ecs_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database_url.arn
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for ECS Task (application role - least privilege)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_role" {
  name_prefix = "ecs-task-role-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "ecs-task-role-${var.env}-${local.service_name}"
    }
  )
}

# Policy for application: CloudWatch Logs + specific Secrets Manager access
resource "aws_iam_role_policy" "ecs_task_role_policy" {
  name_prefix = "ecs-task-role-policy-${var.env}-"
  role        = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ecs.arn}:*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database_url.arn
        ]
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Task Definition
# SEC-CONTROL: Credentials from Secrets Manager via secretsFrom
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "main" {
  family                   = "${var.env}-${local.service_name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = local.component
      image     = "${local.ecr_repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      # SEC-CONTROL: DATABASE_URL from Secrets Manager, not environment variables
      secretsFrom = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      environment = [
        {
          name  = "NODE_ENV"
          value = var.env == "prod" ? "production" : "development"
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        }
      ]
    }
  ])

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-task-def"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# Launch Template for ECS on EC2 (for ASG)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_launch_template" "ecs" {
  name_prefix   = "${var.env}-${local.service_name}-launch-"
  image_id      = data.aws_ami.ecs_ami.id
  instance_type = var.instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.ecs_instance_profile.arn
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    cluster_name = aws_ecs_cluster.main.name
    region       = var.aws_region
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      local.common_tags,
      {
        Name = "${var.env}-${local.service_name}-ec2"
      }
    )
  }

  tag_specifications {
    resource_type = "volume"
    tags = local.common_tags
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for ECS EC2 Instance
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_instance_role" {
  name_prefix = "ecs-instance-role-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "ecs-instance-role-${var.env}-${local.service_name}"
    }
  )
}

resource "aws_iam_role_policy_attachment" "ecs_instance_role_policy" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance_profile" {
  name_prefix = "ecs-instance-profile-${var.env}-"
  role        = aws_iam_role.ecs_instance_role.name
}

# ─────────────────────────────────────────────────────────────────────────────
# Auto Scaling Group for ECS Cluster
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_autoscaling_group" "ecs" {
  name                = "${var.env}-${local.service_name}-asg"
  vpc_zone_identifier = local.private_subnet_ids
  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  min_size         = var.asg_min_size
  max_size         = var.asg_max_size
  desired_capacity = var.asg_desired_capacity

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "${var.env}-${local.service_name}-asg"
    propagate_launch_template = false
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# ECS Service (with ALB integration)
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "main" {
  name            = "${var.env}-${local.service_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "EC2"

  load_balancer {
    target_group_arn = aws_lb_target_group.main.arn
    container_name   = local.component
    container_port   = var.container_port
  }

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false  # SEC-CONTROL: no public IPs
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy.ecs_task_execution_secrets
  ]

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-service"
    }
  )
}

# Auto-scaling for ECS Service
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_policy_cpu" {
  name               = "${var.env}-${local.service_name}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# CodeDeploy Application and Deployment Group
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_codedeploy_app" "main" {
  name                      = "${var.env}-${local.service_name}-app"
  compute_platform          = "Server"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-codedeploy-app"
    }
  )
}

resource "aws_codedeploy_deployment_group" "main" {
  app_name               = aws_codedeploy_app.main.name
  deployment_group_name  = "${var.env}-${local.service_name}-deployment-group"
  deployment_config_name = "CodeDeployDefault.OneAtATime"
  service_role_arn       = aws_iam_role.codedeploy_role.arn

  auto_rollback_configuration {
    enabled = true
    events  = ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_TIMEOUT"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-deployment-group"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for CodeDeploy
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "codedeploy_role" {
  name_prefix = "codedeploy-role-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codedeploy.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "codedeploy-role-${var.env}-${local.service_name}"
    }
  )
}

resource "aws_iam_role_policy_attachment" "codedeploy_policy" {
  role       = aws_iam_role.codedeploy_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSCodeDeployRoleForECS"
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for CodeBuild
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "codebuild_role" {
  name_prefix = "codebuild-role-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "codebuild-role-${var.env}-${local.service_name}"
    }
  )
}

# CodeBuild policy: ECR, logs, VPC, Secrets Manager, tfsec/checkov
resource "aws_iam_role_policy" "codebuild_policy" {
  name_prefix = "codebuild-policy-${var.env}-"
  role        = aws_iam_role.codebuild_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeDhcpOptions",
          "ec2:DescribeVpcs",
          "ec2:CreateNetworkInterfacePermission"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database_url.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codecommit:GitPull"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# IAM Role for CodePipeline
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_iam_role" "codepipeline_role" {
  name_prefix = "codepipeline-role-${var.env}-${local.service_name}-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codepipeline.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    local.common_tags,
    {
      Name = "codepipeline-role-${var.env}-${local.service_name}"
    }
  )
}

resource "aws_iam_role_policy" "codepipeline_policy" {
  name_prefix = "codepipeline-policy-${var.env}-"
  role        = aws_iam_role.codepipeline_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:BatchGetReports",
          "codebuild:ListBuildsForProject",
          "codebuild:ListReports",
          "codebuild:ListReportsForReportGroup",
          "codebuild:ListCuratedEnvironmentImages",
          "codebuild:ListProjects",
          "codebuild:ListSourceCredentials",
          "codebuild:PutSourceCredentials",
          "codebuild:StartBuild",
          "codebuild:InvalidateProjectCache"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codedeploy:CreateDeployment",
          "codedeploy:GetApplication",
          "codedeploy:GetApplicationRevision",
          "codedeploy:GetDeployment",
          "codedeploy:GetDeploymentConfig",
          "codedeploy:RegisterApplicationRevision"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "codecommit:GetBranch",
          "codecommit:GetCommit",
          "codecommit:UploadArchive",
          "codecommit:CancelUploadArchive",
          "codecommit:GetUploadArchiveStatus"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:GetBucketVersioning"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 Bucket for CodePipeline artifacts
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "codepipeline_artifacts" {
  bucket_prefix = "${var.env}-${local.service_name}-artifacts-"

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-pipeline-artifacts"
    }
  )
}

# Encryption for S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "codepipeline_artifacts" {
  bucket = aws_s3_bucket.codepipeline_artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "codepipeline_artifacts" {
  bucket                  = aws_s3_bucket.codepipeline_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────────────────────
# CodePipeline
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_codepipeline" "main" {
  name     = "${var.env}-${local.service_name}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.codepipeline_artifacts.bucket
    type     = "S3"
  }

  stage {
    name = "Source"

    action {
      name             = "SourceAction"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeCommit"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        RepositoryName       = var.codecommit_repository_name
        BranchName           = var.codecommit_branch
        PollForSourceChanges = false
      }
    }
  }

  stage {
    name = "Build"

    action {
      name             = "BuildAction"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]
      version          = "1"

      configuration = {
        ProjectName = aws_codebuild_project.main.name
        EnvironmentVariables = jsonencode([
          {
            name  = "AWS_ACCOUNT_ID"
            value = var.aws_account_id
            type  = "PLAINTEXT"
          },
          {
            name  = "AWS_DEFAULT_REGION"
            value = var.aws_region
            type  = "PLAINTEXT"
          },
          {
            name  = "IMAGE_REPO_NAME"
            value = "${var.env}-${local.service_name}-api"
            type  = "PLAINTEXT"
          },
          {
            name  = "IMAGE_TAG"
            value = "latest"
            type  = "PLAINTEXT"
          },
          {
            name  = "ENVIRONMENT"
            value = var.env
            type  = "PLAINTEXT"
          }
        ])
      }
    }
  }

  stage {
    name = "Deploy"

    action {
      name            = "DeployAction"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "CodeDeploy"
      input_artifacts = ["build_output"]
      version         = "1"

      configuration = {
        ApplicationName             = aws_codedeploy_app.main.name
        DeploymentGroupName         = aws_codedeploy_deployment_group.main.deployment_group_name
      }
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-pipeline"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# CodeBuild Project
# ─────────────────────────────────────────────────────────────────────────────
resource "aws_codebuild_project" "main" {
  name          = "${var.env}-${local.service_name}-build"
  service_role  = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_MEDIUM"
    image                       = "aws/codebuild/standard:7.0"
    type                        = "LINUX_CONTAINER"
    image_pull_credentials_type = "CODEBUILD"
    privileged_mode             = true
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "infra/deploy-hub/buildspec.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = "/aws/codebuild/${var.env}-${local.service_name}"
    }
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${var.env}-${local.service_name}-build-project"
    }
  )
}

# ─────────────────────────────────────────────────────────────────────────────
# AMI data source (Amazon ECS-optimized AMI)
# ─────────────────────────────────────────────────────────────────────────────
data "aws_ami" "ecs_ami" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}
