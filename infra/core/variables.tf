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

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC"
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB)"
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets (ECS, RDS)"
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "rds_allocated_storage" {
  type        = number
  description = "Allocated storage for RDS in GB"
  default     = 20
}

variable "rds_instance_class" {
  type        = string
  description = "RDS instance type"
  default     = "db.t3.micro"
}

variable "rds_master_username" {
  type        = string
  description = "RDS master username"
  default     = "postgres"
  sensitive   = true
}

variable "rds_master_password" {
  type        = string
  description = "RDS master password (retrieve from AWS Secrets Manager in production)"
  sensitive   = true
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
