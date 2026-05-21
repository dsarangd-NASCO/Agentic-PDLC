import { Deployment, IDeploymentRepository } from '@entities/Deployment';
import { DeploymentStage } from '@entities/DeploymentStage';

export class GetDeploymentStatusResponse {
  constructor(
    readonly deploymentId: string,
    readonly status: string,
    readonly progress: number,
    readonly currentStage: string | null,
    readonly updatedAt: Date,
    readonly completedAt: Date | undefined,
    readonly errorMessage: string | undefined,
  ) {}
}

/**
 * GetDeploymentStatusUseCase
 * Retrieves deployment status with <100ms SLA
 * Depends only on entities and repository interface
 */
export class GetDeploymentStatusUseCase {
  constructor(private repository: IDeploymentRepository) {}

  async execute(deploymentId: string): Promise<GetDeploymentStatusResponse> {
    const deployment = await this.repository.getById(deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    const currentStage = await this.getCurrentStage(deploymentId);

    return new GetDeploymentStatusResponse(
      deployment.id,
      deployment.getStatus(),
      deployment.getProgress(),
      currentStage?.stageName ?? null,
      deployment.getUpdatedAt(),
      deployment.getCompletedAt(),
      deployment.getErrorMessage(),
    );
  }

  private async getCurrentStage(deploymentId: string): Promise<DeploymentStage | null> {
    // In a full implementation, this would query the repository
    // For now, we'll return null (stages fetched separately)
    return null;
  }
}
