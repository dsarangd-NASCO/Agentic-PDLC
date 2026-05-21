// API Types - Generated from API-CONTRACTS.yaml

export type DeploymentStatus =
  | 'queued'
  | 'preparing'
  | 'validating'
  | 'deploying'
  | 'verifying'
  | 'complete'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back';

export type CurrentStage = 'prepare' | 'validate' | 'deploy' | 'verify' | 'finalize' | null;

export type TargetEnv = 'dev' | 'stage' | 'prod';

export type StageStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface DeploymentRequest {
  service_id: string;
  target_env: TargetEnv;
  artifact_url: string;
  health_check_url: string;
  health_check_timeout_seconds?: number;
  approval_required?: boolean;
  idempotency_key?: string;
}

export interface DeploymentResponse {
  deployment_id: string;
  service_id: string;
  target_env: TargetEnv;
  status: DeploymentStatus;
  artifact_url: string;
  progress: number;
  current_stage: CurrentStage;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_message: string | null;
  previous_deployment_id: string | null;
}

export interface DeploymentStage {
  stage_name: 'prepare' | 'validate' | 'deploy' | 'verify' | 'finalize';
  status: StageStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
}

export interface DeploymentStagesResponse {
  deployment_id: string;
  stages: DeploymentStage[];
}

export interface RollbackRequest {
  reason?: string;
}

export interface RollbackResponse {
  rollback_id: string;
  deployment_id: string;
  previous_deployment_id: string;
  status: 'initiated' | 'in_progress' | 'complete' | 'failed';
  created_at: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks?: {
    database?: 'ok' | 'error';
    codebuild?: 'ok' | 'error';
    codedeploy?: 'ok' | 'error';
  };
  uptime_seconds?: number;
  timestamp?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  request_id: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DeploymentFilters {
  service_id?: string;
  status?: DeploymentStatus;
  target_env?: TargetEnv;
  limit?: number;
  offset?: number;
}
