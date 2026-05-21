import { Deployment, DeploymentEnvironment, IDeploymentRepository } from '@entities/Deployment';
import { v4 as uuidv4 } from 'uuid';

export class SubmitDeploymentRequest {
  constructor(
    readonly serviceId: string,
    readonly targetEnv: DeploymentEnvironment,
    readonly artifactUrl: string,
    readonly healthCheckUrl: string,
    readonly healthCheckTimeoutSeconds: number = 30,
    readonly createdBy: string,
    readonly idempotencyKey?: string,
  ) {}
}

export class SubmitDeploymentResponse {
  constructor(
    readonly deploymentId: string,
    readonly status: string,
    readonly createdAt: Date,
  ) {}
}

/**
 * SubmitDeploymentUseCase
 * Handles deployment request submission and validation
 * Depends only on entities and repository interface
 */
export class SubmitDeploymentUseCase {
  constructor(private repository: IDeploymentRepository) {}

  async execute(request: SubmitDeploymentRequest): Promise<SubmitDeploymentResponse> {
    // Check for idempotency
    if (request.idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(request.idempotencyKey);
      if (existing) {
        return new SubmitDeploymentResponse(
          existing.id,
          existing.getStatus(),
          existing.createdAt,
        );
      }
    }

    // Validate deployment environment
    if (!Object.values(DeploymentEnvironment).includes(request.targetEnv)) {
      throw new Error(`Invalid target environment: ${request.targetEnv}`);
    }

    // Validate artifact URL
    if (!this.isValidArtifactUrl(request.artifactUrl)) {
      throw new Error(
        'Invalid artifact URL format. Must be ecr:// or s3:// with immutable tag/sha',
      );
    }

    // Validate health check URL
    if (!this.isValidUrl(request.healthCheckUrl)) {
      throw new Error('Invalid health check URL format');
    }

    // Validate health check timeout
    if (
      request.healthCheckTimeoutSeconds < 10 ||
      request.healthCheckTimeoutSeconds > 120
    ) {
      throw new Error(
        'Health check timeout must be between 10 and 120 seconds',
      );
    }

    // Create deployment entity
    const deployment = Deployment.create(
      request.serviceId,
      request.targetEnv,
      request.artifactUrl,
      request.healthCheckUrl,
      request.healthCheckTimeoutSeconds,
      request.createdBy,
      request.idempotencyKey,
    );

    // Persist deployment
    await this.repository.save(deployment);

    return new SubmitDeploymentResponse(
      deployment.id,
      deployment.getStatus(),
      deployment.createdAt,
    );
  }

  private isValidArtifactUrl(url: string): boolean {
    // Must start with ecr:// or s3://
    if (!url.startsWith('ecr://') && !url.startsWith('s3://')) {
      return false;
    }

    // Must not be mutable tag
    if (url.includes(':latest') || url.includes(':main') || url.includes(':dev')) {
      return false;
    }

    // ECR format: ecr://123456789012.dkr.ecr.region.amazonaws.com/repo:tag
    if (url.startsWith('ecr://')) {
      const ecrPattern =
        /^ecr:\/\/\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/[a-z0-9-]+:[a-z0-9._-]+$/i;
      return ecrPattern.test(url);
    }

    // S3 format: s3://bucket/path/to/artifact
    if (url.startsWith('s3://')) {
      const s3Pattern = /^s3:\/\/[a-z0-9.-]+\/[a-zA-Z0-9._\/-]+$/i;
      return s3Pattern.test(url);
    }

    return false;
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Allow https and http for localhost/dev
      return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
    } catch {
      return false;
    }
  }
}
