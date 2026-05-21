import { DeploymentEnvironment } from './Deployment';

/**
 * Service configuration - deployment metadata
 * ZERO external dependencies
 */
export class ServiceConfig {
  readonly serviceId: string;
  readonly artifactRegistryUrl: string;
  readonly healthCheckUrl: string;
  readonly healthCheckTimeoutSeconds: number;
  readonly rollbackStrategy: 'automatic' | 'manual';
  readonly ownerTeam: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(
    serviceId: string,
    artifactRegistryUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    rollbackStrategy: 'automatic' | 'manual',
    ownerTeam: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.serviceId = serviceId;
    this.artifactRegistryUrl = artifactRegistryUrl;
    this.healthCheckUrl = healthCheckUrl;
    this.healthCheckTimeoutSeconds = healthCheckTimeoutSeconds;
    this.rollbackStrategy = rollbackStrategy;
    this.ownerTeam = ownerTeam;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create(
    serviceId: string,
    artifactRegistryUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    rollbackStrategy: 'automatic' | 'manual',
    ownerTeam: string,
  ): ServiceConfig {
    const now = new Date();
    return new ServiceConfig(
      serviceId,
      artifactRegistryUrl,
      healthCheckUrl,
      healthCheckTimeoutSeconds,
      rollbackStrategy,
      ownerTeam,
      now,
      now,
    );
  }

  static restore(
    serviceId: string,
    artifactRegistryUrl: string,
    healthCheckUrl: string,
    healthCheckTimeoutSeconds: number,
    rollbackStrategy: 'automatic' | 'manual',
    ownerTeam: string,
    createdAt: Date,
    updatedAt: Date,
  ): ServiceConfig {
    return new ServiceConfig(
      serviceId,
      artifactRegistryUrl,
      healthCheckUrl,
      healthCheckTimeoutSeconds,
      rollbackStrategy,
      ownerTeam,
      createdAt,
      updatedAt,
    );
  }
}
