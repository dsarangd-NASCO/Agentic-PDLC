output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "List of private subnet IDs"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "List of public subnet IDs"
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.deploy_hub.repository_url
  description = "ECR repository URL"
}

output "ecr_repository_name" {
  value       = aws_ecr_repository.deploy_hub.name
  description = "ECR repository name"
}

output "rds_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "RDS endpoint (host:port)"
}

output "rds_address" {
  value       = aws_db_instance.main.address
  description = "RDS hostname"
}

output "rds_port" {
  value       = aws_db_instance.main.port
  description = "RDS port"
}

output "rds_database_name" {
  value       = aws_db_instance.main.db_name
  description = "RDS database name"
}

output "rds_security_group_id" {
  value       = aws_security_group.rds.id
  description = "RDS security group ID"
}

output "nat_gateway_ips" {
  value       = aws_eip.nat[*].public_ip
  description = "Public IPs of NAT gateways"
}
