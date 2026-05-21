import { describe, it, expect } from 'vitest';
import { DeploymentStage, DeploymentStageName, DeploymentStageStatus } from '../../../src/entities/DeploymentStage';

describe('DeploymentStage Entity', () => {
  describe('create', () => {
    it('should create a new stage in queued status', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.PREPARE,
      );

      expect(stage.id).toBeDefined();
      expect(stage.deploymentId).toBe('deployment-id-123');
      expect(stage.stageName).toBe(DeploymentStageName.PREPARE);
      expect(stage.status).toBe(DeploymentStageStatus.QUEUED);
      expect(stage.startedAt).toBeDefined();
      expect(stage.completedAt).toBeUndefined();
      expect(stage.attempt).toBe(1);
    });
  });

  describe('restore', () => {
    it('should restore stage from persisted state', () => {
      const now = new Date();
      const stage = DeploymentStage.restore(
        'stage-id-123',
        'deployment-id-123',
        DeploymentStageName.VALIDATE,
        DeploymentStageStatus.COMPLETE,
        now,
        new Date(now.getTime() + 1000),
        1000,
      );

      expect(stage.id).toBe('stage-id-123');
      expect(stage.deploymentId).toBe('deployment-id-123');
      expect(stage.status).toBe(DeploymentStageStatus.COMPLETE);
      expect(stage.durationMs).toBe(1000);
    });
  });

  describe('stage transitions', () => {
    it('should transition from queued to running', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.PREPARE,
      );

      const runningStage = stage.markAsRunning();

      expect(runningStage.status).toBe(DeploymentStageStatus.RUNNING);
      expect(runningStage.id).toBe(stage.id);
      expect(runningStage.startedAt).toEqual(stage.startedAt);
    });

    it('should transition from running to complete', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.VALIDATE,
      );

      const runningStage = stage.markAsRunning();
      const completedStage = runningStage.markAsComplete();

      expect(completedStage.status).toBe(DeploymentStageStatus.COMPLETE);
      expect(completedStage.completedAt).toBeDefined();
      expect(completedStage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration correctly', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.DEPLOY,
      );

      const runningStage = stage.markAsRunning();
      const completedStage = runningStage.markAsComplete();

      expect(completedStage.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof completedStage.durationMs).toBe('number');
    });

    it('should transition from running to failed', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.DEPLOY,
      );

      const runningStage = stage.markAsRunning();
      const failedStage = runningStage.markAsFailed('Deployment timeout');

      expect(failedStage.status).toBe(DeploymentStageStatus.FAILED);
      expect(failedStage.errorMessage).toBe('Deployment timeout');
      expect(failedStage.completedAt).toBeDefined();
      expect(failedStage.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('immutability', () => {
    it('should create new instance on state change', () => {
      const stage1 = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.VERIFY,
      );

      const stage2 = stage1.markAsRunning();

      // Original should not change
      expect(stage1.status).toBe(DeploymentStageStatus.QUEUED);
      // New instance should have updated status
      expect(stage2.status).toBe(DeploymentStageStatus.RUNNING);
      // But same ID
      expect(stage1.id).toBe(stage2.id);
    });

    it('should preserve attempt count', () => {
      const stage = DeploymentStage.restore(
        'stage-id-123',
        'deployment-id-123',
        DeploymentStageName.DEPLOY,
        DeploymentStageStatus.COMPLETE,
        new Date(),
        new Date(),
        1000,
        undefined,
        3,
      );

      expect(stage.attempt).toBe(3);
    });
  });

  describe('all stage types', () => {
    it('should support prepare stage', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.PREPARE,
      );
      expect(stage.stageName).toBe(DeploymentStageName.PREPARE);
    });

    it('should support validate stage', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.VALIDATE,
      );
      expect(stage.stageName).toBe(DeploymentStageName.VALIDATE);
    });

    it('should support deploy stage', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.DEPLOY,
      );
      expect(stage.stageName).toBe(DeploymentStageName.DEPLOY);
    });

    it('should support verify stage', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.VERIFY,
      );
      expect(stage.stageName).toBe(DeploymentStageName.VERIFY);
    });

    it('should support finalize stage', () => {
      const stage = DeploymentStage.create(
        'deployment-id-123',
        DeploymentStageName.FINALIZE,
      );
      expect(stage.stageName).toBe(DeploymentStageName.FINALIZE);
    });
  });
});
