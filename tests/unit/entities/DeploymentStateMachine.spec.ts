import { describe, it, expect, beforeEach } from 'vitest';
import { DeploymentStateMachine } from '../../../src/entities/DeploymentStateMachine';
import { DeploymentStatus } from '../../../src/entities/Deployment';

describe('DeploymentStateMachine', () => {
  let stateMachine: DeploymentStateMachine;

  describe('queued status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.QUEUED);
    });

    it('can transition to preparing', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.PREPARING)).toBe(true);
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });

    it('cannot transition to validating', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.VALIDATING)).toBe(
        false,
      );
    });

    it('cannot transition to deploying', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.DEPLOYING)).toBe(
        false,
      );
    });
  });

  describe('preparing status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.PREPARING);
    });

    it('can transition to validating', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.VALIDATING)).toBe(
        true,
      );
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });

    it('cannot transition back to queued', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.QUEUED)).toBe(
        false,
      );
    });
  });

  describe('validating status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.VALIDATING);
    });

    it('can transition to deploying', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.DEPLOYING)).toBe(
        true,
      );
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });
  });

  describe('deploying status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.DEPLOYING);
    });

    it('can transition to verifying', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.VERIFYING)).toBe(
        true,
      );
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });
  });

  describe('verifying status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.VERIFYING);
    });

    it('can transition to complete', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.COMPLETE)).toBe(
        true,
      );
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });

    it('can transition to rolling_back', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.ROLLING_BACK)).toBe(
        true,
      );
    });
  });

  describe('rolling_back status', () => {
    beforeEach(() => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.ROLLING_BACK);
    });

    it('can transition to rolled_back', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.ROLLED_BACK)).toBe(
        true,
      );
    });

    it('can transition to failed', () => {
      expect(stateMachine.canTransitionTo(DeploymentStatus.FAILED)).toBe(true);
    });
  });

  describe('terminal states', () => {
    it('complete state has no transitions', () => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.COMPLETE);
      expect(stateMachine.getValidTransitions()).toHaveLength(0);
    });

    it('failed state has no transitions', () => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.FAILED);
      expect(stateMachine.getValidTransitions()).toHaveLength(0);
    });

    it('rolled_back state has no transitions', () => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.ROLLED_BACK);
      expect(stateMachine.getValidTransitions()).toHaveLength(0);
    });
  });

  describe('getValidTransitions', () => {
    it('returns all valid transitions from queued', () => {
      stateMachine = new DeploymentStateMachine(DeploymentStatus.QUEUED);
      const transitions = stateMachine.getValidTransitions();
      expect(transitions).toContain(DeploymentStatus.PREPARING);
      expect(transitions).toContain(DeploymentStatus.FAILED);
      expect(transitions).toHaveLength(2);
    });
  });
});
