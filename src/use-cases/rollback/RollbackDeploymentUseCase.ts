import { Deployment, DeploymentStatus, IDeploymentRepository } from '@entities/Deployment';

export class RollbackDeploymentRequest {
  constructor(
    readonly deploymentId: string,
    readonly reason?: string,
    readonly operator: string = 'system',
  ) {}
}

export class RollbackDeploymentResponse {
  constructor(
    readonly rollbackId: string,
    readonly deploymentId: string,
    readonly previousDeploymentId: string,
    readonly status: string,
    readonly createdAt: Date,
  ) {}
}

/**
 * RollbackDeploymentUseCase
 * Handles manual rollback triggers
 * Sprint 2 task - basic structure
 */
export class RollbackDeploymentUseCase {
  constructor(private repository: IDeploymentRepository) {}

  async execute(request: RollbackDeploymentRequest): Promise<RollbackDeploymentResponse> {
    const deployment = await this.repository.getById(request.deploymentId);

    if (!deployment) {
      throw new Error(`Deployment not found: ${request.deploymentId}`);
    }

    // Can only rollback from certain states
    const canRollback = [
      DeploymentStatus.VERIFYING,
      DeploymentStatus.FAILED,
    ].includes(deployment.getStatus());

    if (!canRollback) {
      throw new Error(
        `Cannot rollback deployment in state '${deployment.getStatus()}'`,
      );
    }

    if (!deployment.getPreviousDeploymentId()) {
      throw new Error('No previous deployment found for rollback');
    }

    // Transition deployment to rolling back
    deployment.transitionToRollingBack();
    await this.repository.save(deployment);

    return new RollbackDeploymentResponse(
      `rollback-${Date.now()}`,
      deployment.id,
      deployment.getPreviousDeploymentId()!,
      'initiated',
      new Date(),
    );
  }
}
