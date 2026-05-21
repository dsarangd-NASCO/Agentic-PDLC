variable "env" {
  type        = string
  description = "Environment name (dev, stage, prod)"
  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "Environment must be dev, stage, or prod."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "aws_account_id" {
  type        = string
  description = "AWS account ID"
}

variable "container_port" {
  type        = number
  description = "Container port for Next.js application"
  default     = 3000
}

variable "container_memory" {
  type        = number
  description = "Container memory in MB"
  default     = 512
}

variable "container_cpu" {
  type        = number
  description = "Container CPU units"
  default     = 256
}

variable "ecs_desired_count" {
  type        = number
  description = "Desired number of ECS tasks"
  default     = 2
}

variable "ecs_min_capacity" {
  type        = number
  description = "Minimum ECS task capacity"
  default     = 2
}

variable "ecs_max_capacity" {
  type        = number
  description = "Maximum ECS task capacity"
  default     = 4
}

variable "asg_desired_capacity" {
  type        = number
  description = "Desired capacity for auto-scaling group"
  default     = 2
}

variable "asg_min_size" {
  type        = number
  description = "Minimum size of auto-scaling group"
  default     = 1
}

variable "asg_max_size" {
  type        = number
  description = "Maximum size of auto-scaling group"
  default     = 4
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type for ECS"
  default     = "t3.medium"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS"
}

variable "codecommit_repository_name" {
  type        = string
  description = "CodeCommit repository name"
  default     = "deploy-hub"
}

variable "codecommit_branch" {
  type        = string
  description = "CodeCommit branch to deploy from"
  default     = "main"
}

variable "team_owner" {
  type        = string
  description = "Team owning this infrastructure"
  default     = "platform-engineering"
}

variable "cost_center" {
  type        = string
  description = "Cost center for billing"
  default     = "NASCO-Platform"
}

variable "git_repo_url" {
  type        = string
  description = "Git repository URL"
  default     = "nasco/deploy-hub"
}

variable "github_oidc_role_arn" {
  type        = string
  description = "ARN of GitHub OIDC role for assume role"
}
