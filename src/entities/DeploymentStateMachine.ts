import { DeploymentStatus } from './Deployment';

/**
 * Deployment State Machine
 * Defines valid state transitions for a deployment
 * ZERO external dependencies - pure business logic
 */
export class DeploymentStateMachine {
  private readonly currentStatus: DeploymentStatus;

  private readonly allowedTransitions: Map<DeploymentStatus, DeploymentStatus[]> = new Map([
    [
      DeploymentStatus.QUEUED,
      [DeploymentStatus.PREPARING, DeploymentStatus.FAILED],
    ],
    [
      DeploymentStatus.PREPARING,
      [DeploymentStatus.VALIDATING, DeploymentStatus.FAILED],
    ],
    [
      DeploymentStatus.VALIDATING,
      [DeploymentStatus.DEPLOYING, DeploymentStatus.FAILED],
    ],
    [
      DeploymentStatus.DEPLOYING,
      [DeploymentStatus.VERIFYING, DeploymentStatus.FAILED],
    ],
    [
      DeploymentStatus.VERIFYING,
      [
        DeploymentStatus.COMPLETE,
        DeploymentStatus.FAILED,
        DeploymentStatus.ROLLING_BACK,
      ],
    ],
    [
      DeploymentStatus.ROLLING_BACK,
      [DeploymentStatus.ROLLED_BACK, DeploymentStatus.FAILED],
    ],
    [DeploymentStatus.COMPLETE, []],
    [DeploymentStatus.FAILED, []],
    [DeploymentStatus.ROLLED_BACK, []],
  ]);

  constructor(currentStatus: DeploymentStatus) {
    this.currentStatus = currentStatus;
  }

  canTransitionTo(targetStatus: DeploymentStatus): boolean {
    const allowed = this.allowedTransitions.get(this.currentStatus) ?? [];
    return allowed.includes(targetStatus);
  }

  getValidTransitions(): DeploymentStatus[] {
    return this.allowedTransitions.get(this.currentStatus) ?? [];
  }
}
