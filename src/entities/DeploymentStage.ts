import { v4 as uuidv4 } from 'uuid';

export enum DeploymentStageName {
  PREPARE = 'prepare',
  VALIDATE = 'validate',
  DEPLOY = 'deploy',
  VERIFY = 'verify',
  FINALIZE = 'finalize',
}

export enum DeploymentStageStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/**
 * Immutable deployment stage record
 * ZERO external dependencies
 */
export class DeploymentStage {
  readonly id: string;
  readonly deploymentId: string;
  readonly stageName: DeploymentStageName;
  readonly status: DeploymentStageStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly errorMessage?: string;
  readonly attempt: number;

  private constructor(
    id: string,
    deploymentId: string,
    stageName: DeploymentStageName,
    status: DeploymentStageStatus,
    startedAt: Date,
    completedAt?: Date,
    durationMs?: number,
    errorMessage?: string,
    attempt: number = 1,
  ) {
    this.id = id;
    this.deploymentId = deploymentId;
    this.stageName = stageName;
    this.status = status;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.durationMs = durationMs;
    this.errorMessage = errorMessage;
    this.attempt = attempt;
  }

  static create(
    deploymentId: string,
    stageName: DeploymentStageName,
  ): DeploymentStage {
    return new DeploymentStage(
      uuidv4(),
      deploymentId,
      stageName,
      DeploymentStageStatus.QUEUED,
      new Date(),
    );
  }

  static restore(
    id: string,
    deploymentId: string,
    stageName: DeploymentStageName,
    status: DeploymentStageStatus,
    startedAt: Date,
    completedAt?: Date,
    durationMs?: number,
    errorMessage?: string,
    attempt?: number,
  ): DeploymentStage {
    return new DeploymentStage(
      id,
      deploymentId,
      stageName,
      status,
      startedAt,
      completedAt,
      durationMs,
      errorMessage,
      attempt,
    );
  }

  markAsRunning(): DeploymentStage {
    return new DeploymentStage(
      this.id,
      this.deploymentId,
      this.stageName,
      DeploymentStageStatus.RUNNING,
      this.startedAt,
    );
  }

  markAsComplete(): DeploymentStage {
    const now = new Date();
    const durationMs = now.getTime() - this.startedAt.getTime();
    return new DeploymentStage(
      this.id,
      this.deploymentId,
      this.stageName,
      DeploymentStageStatus.COMPLETE,
      this.startedAt,
      now,
      durationMs,
    );
  }

  markAsFailed(errorMessage: string): DeploymentStage {
    const now = new Date();
    const durationMs = now.getTime() - this.startedAt.getTime();
    return new DeploymentStage(
      this.id,
      this.deploymentId,
      this.stageName,
      DeploymentStageStatus.FAILED,
      this.startedAt,
      now,
      durationMs,
      errorMessage,
    );
  }
}
