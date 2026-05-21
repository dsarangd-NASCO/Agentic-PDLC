import { describe, it, expect, beforeEach } from 'vitest';
import { Deployment, DeploymentStatus, DeploymentEnvironment } from '../../../src/entities/Deployment';

describe('Deployment Entity', () => {
  describe('create', () => {
    it('should create a new deployment in queued status', () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );

      expect(deployment.id).toBeDefined();
      expect(deployment.serviceId).toBe('payments-api');
      expect(deployment.targetEnv).toBe(DeploymentEnvironment.PROD);
      expect(deployment.getStatus()).toBe(DeploymentStatus.QUEUED);
      expect(deployment.createdAt).toBeDefined();
      expect(deployment.createdBy).toBe('user123');
    });

    it('should initialize with progress 0 for queued status', () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );

      expect(deployment.getProgress()).toBe(0);
    });
  });

  describe('restore', () => {
    it('should restore deployment from persisted state', () => {
      const now = new Date();
      const deployment = Deployment.restore(
        'deployment-id-123',
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        now,
        'user123',
        DeploymentStatus.VALIDATING,
        now,
      );

      expect(deployment.id).toBe('deployment-id-123');
      expect(deployment.getStatus()).toBe(DeploymentStatus.VALIDATING);
    });
  });

  describe('state transitions', () => {
    let deployment: Deployment;

    beforeEach(() => {
      deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );
    });

    it('should transition from queued to preparing', () => {
      deployment.transitionToPrepaing();
      expect(deployment.getStatus()).toBe(DeploymentStatus.PREPARING);
    });

    it('should transition from preparing to validating', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      expect(deployment.getStatus()).toBe(DeploymentStatus.VALIDATING);
    });

    it('should transition through full happy path', () => {
      deployment.transitionToPrepaing();
      expect(deployment.getStatus()).toBe(DeploymentStatus.PREPARING);

      deployment.transitionToValidating();
      expect(deployment.getStatus()).toBe(DeploymentStatus.VALIDATING);

      deployment.transitionToDeploying();
      expect(deployment.getStatus()).toBe(DeploymentStatus.DEPLOYING);

      deployment.transitionToVerifying();
      expect(deployment.getStatus()).toBe(DeploymentStatus.VERIFYING);

      deployment.transitionToComplete();
      expect(deployment.getStatus()).toBe(DeploymentStatus.COMPLETE);
      expect(deployment.getCompletedAt()).toBeDefined();
      expect(deployment.getProgress()).toBe(100);
    });

    it('should transition to failed from any stage', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToFailed('Artifact not found');

      expect(deployment.getStatus()).toBe(DeploymentStatus.FAILED);
      expect(deployment.getErrorMessage()).toBe('Artifact not found');
      expect(deployment.getCompletedAt()).toBeDefined();
    });

    it('should transition to rolling_back from verifying', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      deployment.transitionToVerifying();
      deployment.transitionToRollingBack();

      expect(deployment.getStatus()).toBe(DeploymentStatus.ROLLING_BACK);
    });

    it('should transition from rolling_back to rolled_back', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      deployment.transitionToVerifying();
      deployment.transitionToRollingBack();
      deployment.transitionToRolledBack();

      expect(deployment.getStatus()).toBe(DeploymentStatus.ROLLED_BACK);
      expect(deployment.getCompletedAt()).toBeDefined();
    });

    it('should throw error on invalid transition', () => {
      expect(() => {
        deployment.transitionToValidating();
      }).toThrow(/Cannot transition from queued to validating/);
    });

    it('should throw error when trying to transition from terminal state', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToFailed('Test error');

      expect(() => {
        deployment.transitionToValidating();
      }).toThrow(/Cannot transition from failed to validating/);
    });
  });

  describe('progress calculation', () => {
    let deployment: Deployment;

    beforeEach(() => {
      deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );
    });

    it('should return 0% for queued', () => {
      expect(deployment.getProgress()).toBe(0);
    });

    it('should return 20% for preparing', () => {
      deployment.transitionToPrepaing();
      expect(deployment.getProgress()).toBe(20);
    });

    it('should return 40% for validating', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      expect(deployment.getProgress()).toBe(40);
    });

    it('should return 60% for deploying', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      expect(deployment.getProgress()).toBe(60);
    });

    it('should return 80% for verifying', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      deployment.transitionToVerifying();
      expect(deployment.getProgress()).toBe(80);
    });

    it('should return 100% for complete', () => {
      deployment.transitionToPrepaing();
      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      deployment.transitionToVerifying();
      deployment.transitionToComplete();
      expect(deployment.getProgress()).toBe(100);
    });
  });

  describe('deployment tracking', () => {
    it('should track previous deployment for rollback', () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );

      const previousId = 'previous-deployment-id';
      deployment.setPreviousDeploymentId(previousId);

      expect(deployment.getPreviousDeploymentId()).toBe(previousId);
    });
  });

  describe('idempotency', () => {
    it('should preserve idempotency key', () => {
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
        idempotencyKey,
      );

      expect(deployment.idempotencyKey).toBe(idempotencyKey);
    });
  });

  describe('timestamps', () => {
    it('should update updatedAt when transitioning', () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );

      const initialUpdatedAt = deployment.getUpdatedAt();

      // Small delay to ensure timestamp difference
      const delay = new Promise((resolve) => setTimeout(resolve, 10));
      delay.then(() => {
        deployment.transitionToPrepaing();
        expect(deployment.getUpdatedAt().getTime()).toBeGreaterThan(
          initialUpdatedAt.getTime(),
        );
      });
    });

    it('should set completedAt only for terminal states', () => {
      const deployment = Deployment.create(
        'payments-api',
        DeploymentEnvironment.PROD,
        'ecr://image:tag',
        'https://payments.nasco.com/health',
        30,
        'user123',
      );

      expect(deployment.getCompletedAt()).toBeUndefined();

      deployment.transitionToPrepaing();
      expect(deployment.getCompletedAt()).toBeUndefined();

      deployment.transitionToValidating();
      deployment.transitionToDeploying();
      deployment.transitionToVerifying();
      deployment.transitionToComplete();

      expect(deployment.getCompletedAt()).toBeDefined();
    });
  });
});
