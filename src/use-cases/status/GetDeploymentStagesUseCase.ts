import { Deployment, IDeploymentRepository } from '@entities/Deployment';
import { DeploymentStage } from '@entities/DeploymentStage';

export class GetDeploymentStagesResponse {
  constructor(
    readonly deploymentId: string,
    readonly stages: Array<{
      stageName: string;
      status: string;
      startedAt: Date;
      completedAt?: Date;
      durationMs?: number;
      errorMessage?: string;
    }>,
  ) {}
}

/**
 * Interface for repository with stage methods
 */
interface IDeploymentRepositoryWithStages extends IDeploymentRepository {
  getStagesByDeploymentId(deploymentId: string): Promise<DeploymentStage[]>;
}

/**
 * GetDeploymentStagesUseCase
 * Retrieves detailed stage breakdown for a deployment
 */
export class GetDeploymentStagesUseCase {
  constructor(private repository: IDeploymentRepositoryWithStages) {}

  async execute(deploymentId: string): Promise<GetDeploymentStagesResponse> {
    // Verify deployment exists
    const deployment = await this.repository.getById(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    // Get stages
    const stages = await this.repository.getStagesByDeploymentId(deploymentId);

    return new GetDeploymentStagesResponse(
      deploymentId,
      stages.map((stage) => ({
        stageName: stage.stageName,
        status: stage.status,
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        durationMs: stage.durationMs,
        errorMessage: stage.errorMessage,
      })),
    );
  }
}
