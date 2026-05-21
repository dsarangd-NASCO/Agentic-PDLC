import { v4 as uuidv4 } from 'uuid';

export enum DeploymentStatus {
  QUEUED = 'queued',
  PREPARING = 'preparing',
  VALIDATING = 'validating',
  DEPLOYING = 'deploying',
  VERIFYING = 'verifying',
  COMPLETE = 'complete',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back',
}

export enum DeploymentEnvironment {
  DEV = 'dev',
  STAGE = 'stage',
  PROD = 'prod',
}

export interface IDeploymentRepository {
  save(deployment: Deployment): Promise<void>;
  getById(id: string): Promise<Deployment | null>;
  findByServiceId(serviceId: string): Promise<Deployment[]>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Deployment | null>;
}

/**
 * Deployment entity - core business logic
 * Represents a single deployment operation with immutable history
 * ZERO external dependencies - pure business logic only
 */
export class Deployment {
  readonly id: string;
  readonly serviceId: string;
  readonly targetEnv: DeploymentEnvironment;
  readonly artifactUrl: string;
  readonly healthCheckUrl: string;
  readonly healthCheckTimeoutSeconds: number;
  readonly createdAt: Date;
  readonly createdBy: string;
  readonly idempotencyKey?: string;

  private status: DeploymentStatus;
  private updatedAt: Date;
  private completedAt?: Date;
  private errorMessage?: string;
  private previousDeploymentId?: string;
  private readonly stateMachine: DeploymentStateMachine;

  private constructor(
    id: string,
    serviceId: string,
    targetEnv: DeploymentEnvironment,
    artifactUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    createdAt: Date,
    createdBy: string,
    status: DeploymentStatus,
    updatedAt: Date,
    idempotencyKey?: string,
    completedAt?: Date,
    errorMessage?: string,
    previousDeploymentId?: string,
  ) {
    this.id = id;
    this.serviceId = serviceId;
    this.targetEnv = targetEnv;
    this.artifactUrl = artifactUrl;
    this.healthCheckUrl = healthCheckUrl;
    this.healthCheckTimeoutSeconds = healthCheckTimeoutSeconds;
    this.createdAt = createdAt;
    this.createdBy = createdBy;
    this.status = status;
    this.updatedAt = updatedAt;
    this.idempotencyKey = idempotencyKey;
    this.completedAt = completedAt;
    this.errorMessage = errorMessage;
    this.previousDeploymentId = previousDeploymentId;
    this.stateMachine = new DeploymentStateMachine(this.status);
  }

  static create(
    serviceId: string,
    targetEnv: DeploymentEnvironment,
    artifactUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    createdBy: string,
    idempotencyKey?: string,
  ): Deployment {
    const now = new Date();
    return new Deployment(
      uuidv4(),
      serviceId,
      targetEnv,
      artifactUrl,
      healthCheckUrl,
      healthCheckTimeoutSeconds,
      now,
      createdBy,
      DeploymentStatus.QUEUED,
      now,
      idempotencyKey,
    );
  }

  static restore(
    id: string,
    serviceId: string,
    targetEnv: DeploymentEnvironment,
    artifactUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    createdAt: Date,
    createdBy: string,
    status: DeploymentStatus,
    updatedAt: Date,
    idempotencyKey?: string,
    completedAt?: Date,
    errorMessage?: string,
    previousDeploymentId?: string,
  ): Deployment {
    return new Deployment(
      id,
      serviceId,
      targetEnv,
      artifactUrl,
      healthCheckUrl,
      healthCheckTimeoutSeconds,
      createdAt,
      createdBy,
      status,
      updatedAt,
      idempotencyKey,
      completedAt,
      errorMessage,
      previousDeploymentId,
    );
  }

  getStatus(): DeploymentStatus {
    return this.status;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  getCompletedAt(): Date | undefined {
    return this.completedAt;
  }

  getErrorMessage(): string | undefined {
    return this.errorMessage;
  }

  getPreviousDeploymentId(): string | undefined {
    return this.previousDeploymentId;
  }

  getProgress(): number {
    switch (this.status) {
      case DeploymentStatus.QUEUED:
        return 0;
      case DeploymentStatus.PREPARING:
        return 20;
      case DeploymentStatus.VALIDATING:
        return 40;
      case DeploymentStatus.DEPLOYING:
        return 60;
      case DeploymentStatus.VERIFYING:
        return 80;
      case DeploymentStatus.COMPLETE:
        return 100;
      case DeploymentStatus.FAILED:
      case DeploymentStatus.ROLLED_BACK:
        return 0;
      case DeploymentStatus.ROLLING_BACK:
        return 50;
      default:
        return 0;
    }
  }

  transitionToPrepaing(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.PREPARING)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.PREPARING}`,
      );
    }
    this.status = DeploymentStatus.PREPARING;
    this.updatedAt = new Date();
  }

  transitionToValidating(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.VALIDATING)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.VALIDATING}`,
      );
    }
    this.status = DeploymentStatus.VALIDATING;
    this.updatedAt = new Date();
  }

  transitionToDeploying(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.DEPLOYING)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.DEPLOYING}`,
      );
    }
    this.status = DeploymentStatus.DEPLOYING;
    this.updatedAt = new Date();
  }

  transitionToVerifying(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.VERIFYING)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.VERIFYING}`,
      );
    }
    this.status = DeploymentStatus.VERIFYING;
    this.updatedAt = new Date();
  }

  transitionToComplete(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.COMPLETE)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.COMPLETE}`,
      );
    }
    this.status = DeploymentStatus.COMPLETE;
    this.updatedAt = new Date();
    this.completedAt = new Date();
  }

  transitionToFailed(errorMessage: string): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.FAILED)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.FAILED}`,
      );
    }
    this.status = DeploymentStatus.FAILED;
    this.errorMessage = errorMessage;
    this.updatedAt = new Date();
    this.completedAt = new Date();
  }

  transitionToRollingBack(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.ROLLING_BACK)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.ROLLING_BACK}`,
      );
    }
    this.status = DeploymentStatus.ROLLING_BACK;
    this.updatedAt = new Date();
  }

  transitionToRolledBack(): void {
    if (!this.stateMachine.canTransitionTo(DeploymentStatus.ROLLED_BACK)) {
      throw new Error(
        `Cannot transition from ${this.status} to ${DeploymentStatus.ROLLED_BACK}`,
      );
    }
    this.status = DeploymentStatus.ROLLED_BACK;
    this.updatedAt = new Date();
    this.completedAt = new Date();
  }

  setPreviousDeploymentId(deploymentId: string): void {
    this.previousDeploymentId = deploymentId;
  }
}
