import { describe, it, expect, beforeEach } from 'vitest';
import { SubmitDeploymentUseCase, SubmitDeploymentRequest } from '../../../src/use-cases/submission/SubmitDeploymentUseCase';
import { Deployment, DeploymentEnvironment, IDeploymentRepository } from '../../../src/entities/Deployment';

describe('SubmitDeploymentUseCase', () => {
  let useCase: SubmitDeploymentUseCase;
  let mockRepository: IDeploymentRepository;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      save: async () => {},
      getById: async () => null,
      findByServiceId: async () => [],
      findByIdempotencyKey: async () => null,
    } as any;

    useCase = new SubmitDeploymentUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should create and persist a new deployment', async () => {
      let savedDeployment: Deployment | null = null;

      mockRepository.save = async (deployment: Deployment) => {
        savedDeployment = deployment;
      };

      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      const response = await useCase.execute(request);

      expect(response.deploymentId).toBeDefined();
      expect(response.status).toBe('queued');
      expect(savedDeployment).not.toBeNull();
      expect(savedDeployment?.serviceId).toBe('payments-api');
    });

    it('should support idempotency', async () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const existingDeployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
        idempotencyKey,
      );

      mockRepository.findByIdempotencyKey = async (key: string) => {
        return key === idempotencyKey ? existingDeployment : null;
      };

      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
        idempotencyKey,
      );

      const response = await useCase.execute(request);

      expect(response.deploymentId).toBe(existingDeployment.id);
      expect(response.status).toBe(existingDeployment.getStatus());
    });

    it('should validate artifact URL format', async () => {
      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'invalid://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      await expect(useCase.execute(request)).rejects.toThrow(
        /Invalid artifact URL format/,
      );
    });

    it('should reject mutable artifact tags', async () => {
      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:latest',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      await expect(useCase.execute(request)).rejects.toThrow(
        /Invalid artifact URL format/,
      );
    });

    it('should validate health check URL', async () => {
      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v1.0.0',
        'not-a-url',
        30,
        'user123',
      );

      await expect(useCase.execute(request)).rejects.toThrow(
        /Invalid health check URL format/,
      );
    });

    it('should validate health check timeout range', async () => {
      const request = new SubmitDeploymentRequest(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v1.0.0',
        'https://payments-prod.nasco.com/health',
        5, // Too small
        'user123',
      );

      await expect(useCase.execute(request)).rejects.toThrow(
        /Health check timeout must be between 10 and 120 seconds/,
      );
    });

    it('should accept S3 artifact URLs', async () => {
      let savedDeployment: Deployment | null = null;

      mockRepository.save = async (deployment: Deployment) => {
        savedDeployment = deployment;
      };

      const request = new SubmitDeploymentRequest(
        'auth-service',
        DeploymentEnvironment.STAGE,
        's3://nasco-artifacts/auth-service/v1.2.0/auth-service.war',
        'https://auth-stage.nasco.com/health',
        30,
        'user456',
      );

      const response = await useCase.execute(request);

      expect(response.deploymentId).toBeDefined();
      expect(savedDeployment?.artifactUrl).toContain('s3://');
    });

    it('should validate environment enum', async () => {
      const request = new SubmitDeploymentRequest(
        'payments-api',
        'invalid' as DeploymentEnvironment,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v1.0.0',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      await expect(useCase.execute(request)).rejects.toThrow(
        /Invalid target environment/,
      );
    });
  });
});
