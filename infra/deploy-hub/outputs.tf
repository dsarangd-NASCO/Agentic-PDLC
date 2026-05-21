output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "DNS name of the load balancer"
}

output "alb_arn" {
  value       = aws_lb.main.arn
  description = "ARN of the load balancer"
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "Name of the ECS cluster"
}

output "ecs_cluster_arn" {
  value       = aws_ecs_cluster.main.arn
  description = "ARN of the ECS cluster"
}

output "ecs_service_name" {
  value       = aws_ecs_service.main.name
  description = "Name of the ECS service"
}

output "codepipeline_name" {
  value       = aws_codepipeline.main.name
  description = "Name of the CodePipeline"
}

output "codebuild_project_name" {
  value       = aws_codebuild_project.main.name
  description = "Name of the CodeBuild project"
}

output "database_secret_arn" {
  value       = aws_secretsmanager_secret.database_url.arn
  description = "ARN of the database URL secret"
}

output "target_group_arn" {
  value       = aws_lb_target_group.main.arn
  description = "ARN of the target group"
}

output "target_group_name" {
  value       = aws_lb_target_group.main.name
  description = "Name of the target group"
}

output "ecs_task_definition_arn" {
  value       = aws_ecs_task_definition.main.arn
  description = "ARN of the ECS task definition"
}

output "cloudwatch_log_group" {
  value       = aws_cloudwatch_log_group.ecs.name
  description = "CloudWatch log group for ECS"
}
