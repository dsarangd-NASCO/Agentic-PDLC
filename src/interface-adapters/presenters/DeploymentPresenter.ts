/**
 * DeploymentPresenter
 * Maps deployment entities to HTTP response format
 */

export interface DeploymentResponseDTO {
  deployment_id: string;
  service_id: string;
  target_env: string;
  status: string;
  artifact_url: string;
  progress: number;
  current_stage: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  error_message?: string;
  previous_deployment_id?: string;
}

export interface DeploymentStatusResponseDTO {
  deployment_id: string;
  status: string;
  current_stage: string | null;
  progress: number;
  updated_at: string;
}

export interface DeploymentStageDTO {
  stage_name: string;
  status: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface DeploymentStagesResponseDTO {
  deployment_id: string;
  stages: DeploymentStageDTO[];
}

export interface ErrorResponseDTO {
  error: string;
  message: string;
  request_id: string;
  timestamp: string;
  details?: unknown;
}

export class DeploymentPresenter {
  static presentDeploymentResponse(deployment: {
    id: string;
    serviceId: string;
    targetEnv: string;
    artifactUrl: string;
    getStatus: () => string;
    getProgress: () => number;
    createdAt: Date;
    getUpdatedAt: () => Date;
    getCompletedAt: () => Date | undefined;
    getErrorMessage: () => string | undefined;
    getPreviousDeploymentId: () => string | undefined;
  }): DeploymentResponseDTO {
    return {
      deployment_id: deployment.id,
      service_id: deployment.serviceId,
      target_env: deployment.targetEnv,
      status: deployment.getStatus(),
      artifact_url: deployment.artifactUrl,
      progress: deployment.getProgress(),
      current_stage: null, // Would be populated from deployment_stages table
      created_at: deployment.createdAt.toISOString(),
      updated_at: deployment.getUpdatedAt().toISOString(),
      completed_at: deployment.getCompletedAt()?.toISOString(),
      error_message: deployment.getErrorMessage(),
      previous_deployment_id: deployment.getPreviousDeploymentId(),
    };
  }

  static presentStatusResponse(deployment: {
    id: string;
    getStatus: () => string;
    getProgress: () => number;
    getUpdatedAt: () => Date;
  }): DeploymentStatusResponseDTO {
    return {
      deployment_id: deployment.id,
      status: deployment.getStatus(),
      current_stage: null,
      progress: deployment.getProgress(),
      updated_at: deployment.getUpdatedAt().toISOString(),
    };
  }

  static presentErrorResponse(
    error: string,
    message: string,
    requestId: string,
  ): ErrorResponseDTO {
    return {
      error,
      message,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    };
  }
}
