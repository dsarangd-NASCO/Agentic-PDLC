import { v4 as uuidv4 } from 'uuid';
import { SubmitDeploymentUseCase, SubmitDeploymentRequest } from '@use-cases/submission/SubmitDeploymentUseCase';
import { GetDeploymentStatusUseCase } from '@use-cases/status/GetDeploymentStatusUseCase';
import { DeploymentEnvironment } from '@entities/Deployment';
import { Logger } from '@common/logging/Logger';
import { DeploymentPresenter, DeploymentResponseDTO, DeploymentStatusResponseDTO, ErrorResponseDTO } from '@adapters/presenters/DeploymentPresenter';
import {
  DeploymentNotFoundError,
  InvalidDeploymentRequest,
  UnauthorizedError,
  ForbiddenError,
  InternalServerError,
} from '@common/errors/DeploymentError';

/**
 * DeploymentController
 * HTTP request/response handlers for deployment endpoints
 */
export class DeploymentController {
  private logger = new Logger('DeploymentController');

  constructor(
    private submitDeploymentUseCase: SubmitDeploymentUseCase,
    private getDeploymentStatusUseCase: GetDeploymentStatusUseCase,
  ) {}

  async submitDeployment(
    body: {
      service_id: string;
      target_env: string;
      artifact_url: string;
      health_check_url: string;
      health_check_timeout_seconds?: number;
      idempotency_key?: string;
    },
    userId: string,
  ): Promise<{ data: DeploymentResponseDTO; statusCode: number }> {
    const requestId = uuidv4();

    try {
      this.logger.info('Deployment submission received', {
        requestId,
        serviceId: body.service_id,
        targetEnv: body.target_env,
      });

      // Validate required fields
      if (!body.service_id || !body.target_env || !body.artifact_url || !body.health_check_url) {
        throw new InvalidDeploymentRequest('Missing required fields');
      }

      // Validate service ID format
      if (!/^[a-z][a-z0-9\-]{0,19}$/.test(body.service_id)) {
        throw new InvalidDeploymentRequest(
          'Invalid service_id format. Must start with lowercase letter, contain only lowercase letters, digits, and hyphens, max 20 chars',
        );
      }

      // Validate environment
      if (!Object.values(DeploymentEnvironment).includes(body.target_env as DeploymentEnvironment)) {
        throw new InvalidDeploymentRequest(`Invalid target_env: ${body.target_env}`);
      }

      // Create use case request
      const request = new SubmitDeploymentRequest(
        body.service_id,
        body.target_env as DeploymentEnvironment,
        body.artifact_url,
        body.health_check_url,
        body.health_check_timeout_seconds ?? 30,
        userId,
        body.idempotency_key,
      );

      // Execute use case
      const response = await this.submitDeploymentUseCase.execute(request);

      this.logger.info('Deployment submitted successfully', {
        requestId,
        deploymentId: response.deploymentId,
      });

      // Return response (would fetch full deployment here in real implementation)
      return {
        data: {
          deployment_id: response.deploymentId,
          service_id: body.service_id,
          target_env: body.target_env,
          status: response.status,
          artifact_url: body.artifact_url,
          progress: 0,
          current_stage: null,
          created_at: response.createdAt.toISOString(),
          updated_at: response.createdAt.toISOString(),
        },
        statusCode: 201,
      };
    } catch (error) {
      this.logger.error('Deployment submission failed', error as Error, { requestId });
      throw error;
    }
  }

  async getDeployment(
    deploymentId: string,
  ): Promise<{ data: DeploymentStatusResponseDTO; statusCode: number }> {
    const requestId = uuidv4();

    try {
      this.logger.info('Deployment status request', {
        requestId,
        deploymentId,
      });

      const response = await this.getDeploymentStatusUseCase.execute(deploymentId);

      return {
        data: {
          deployment_id: response.deploymentId,
          status: response.status,
          current_stage: response.currentStage,
          progress: response.progress,
          updated_at: response.updatedAt.toISOString(),
        },
        statusCode: 200,
      };
    } catch (error) {
      this.logger.error('Deployment status request failed', error as Error, { requestId });
      throw error;
    }
  }
}
