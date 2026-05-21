import { describe, it, expect, beforeEach } from 'vitest';
import { GetDeploymentStatusUseCase } from '../../../src/use-cases/status/GetDeploymentStatusUseCase';
import { Deployment, DeploymentEnvironment, IDeploymentRepository } from '../../../src/entities/Deployment';

describe('GetDeploymentStatusUseCase', () => {
  let useCase: GetDeploymentStatusUseCase;
  let mockRepository: IDeploymentRepository;

  beforeEach(() => {
    mockRepository = {
      save: async () => {},
      getById: async () => null,
      findByServiceId: async () => [],
    } as any;

    useCase = new GetDeploymentStatusUseCase(mockRepository);
  });

  describe('execute', () => {
    it('should return deployment status', async () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      mockRepository.getById = async (id: string) => {
        return id === deployment.id ? deployment : null;
      };

      const response = await useCase.execute(deployment.id);

      expect(response.deploymentId).toBe(deployment.id);
      expect(response.status).toBe('queued');
      expect(response.progress).toBe(0);
    });

    it('should throw error if deployment not found', async () => {
      mockRepository.getById = async () => null;

      await expect(
        useCase.execute('non-existent-id'),
      ).rejects.toThrow(/Deployment not found/);
    });

    it('should reflect deployment progress', async () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();

      mockRepository.getById = async (id: string) => {
        return id === deployment.id ? deployment : null;
      };

      const response = await useCase.execute(deployment.id);

      expect(response.progress).toBe(60);
      expect(response.status).toBe('deploying');
    });

    it('should include error message for failed deployments', async () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments-prod.nasco.com/health',
        30,
        'user123',
      );

      deployment.transitionToPrepaing();
      deployment.transitionToFailed('Artifact pull failed');

      mockRepository.getById = async (id: string) => {
        return id === deployment.id ? deployment : null;
      };

      const response = await useCase.execute(deployment.id);

      expect(response.status).toBe('failed');
      expect(response.errorMessage).toBe('Artifact pull failed');
    });
  });
});
