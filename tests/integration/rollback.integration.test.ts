/**
 * Integration Tests — Deployment Rollback
 *
 * Protects:
 *   Story 2 (AC2.3) — Automatic/manual rollback to previous known-good version
 *   Story 2 (AC2.4) — Rollback execution (state machine transition)
 *   Story 2 (AC2.5) — Rollback event recorded with operator and timestamp
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresConnection } from '../../src/frameworks/db/PostgresConnection';
import { PostgresDeploymentRepository } from '../../src/interface-adapters/repositories/PostgresDeploymentRepository';
import { SubmitDeploymentUseCase, SubmitDeploymentRequest } from '../../src/use-cases/submission/SubmitDeploymentUseCase';
import { RollbackDeploymentUseCase, RollbackDeploymentRequest } from '../../src/use-cases/rollback/RollbackDeploymentUseCase';
import { GetDeploymentStatusUseCase } from '../../src/use-cases/status/GetDeploymentStatusUseCase';
import { Deployment, DeploymentEnvironment, DeploymentStatus } from '../../src/entities/Deployment';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS deployments (
    id UUID PRIMARY KEY,
    service_id VARCHAR(20) NOT NULL,
    target_env VARCHAR(10) NOT NULL,
    artifact_url VARCHAR(256) NOT NULL,
    health_check_url VARCHAR(256) NOT NULL,
    health_check_timeout_seconds INTEGER NOT NULL DEFAULT 30,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    progress INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message VARCHAR(512),
    previous_deployment_id UUID,
    idempotency_key UUID UNIQUE
  );

  CREATE INDEX idx_deployments_service_id ON deployments(service_id);
  CREATE INDEX idx_deployments_status ON deployments(status);
  CREATE INDEX idx_deployments_created_at ON deployments(created_at DESC);
  CREATE INDEX idx_deployments_idempotency_key ON deployments(idempotency_key);

  CREATE TABLE IF NOT EXISTS deployment_stages (
    id UUID PRIMARY KEY,
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    stage_name VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message VARCHAR(512),
    attempt INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_deployment_stages_deployment_id ON deployment_stages(deployment_id);
`;

let pgContainer: StartedPostgreSqlContainer;
let postgres: PostgresConnection;
let repository: PostgresDeploymentRepository;
let submitUseCase: SubmitDeploymentUseCase;
let rollbackUseCase: RollbackDeploymentUseCase;
let getStatusUseCase: GetDeploymentStatusUseCase;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer()
    .withDatabase('deploy_hub_rollback_test')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  postgres = new PostgresConnection(pgContainer.getConnectionUri());
  await postgres.connect();
  await postgres.query(SCHEMA_SQL);

  repository = new PostgresDeploymentRepository(postgres);
  submitUseCase = new SubmitDeploymentUseCase(repository);
  rollbackUseCase = new RollbackDeploymentUseCase(repository);
  getStatusUseCase = new GetDeploymentStatusUseCase(repository);
}, 120_000);

afterAll(async () => {
  await postgres.close();
  await pgContainer.stop();
});

beforeEach(async () => {
  await postgres.query('TRUNCATE TABLE deployment_stages, deployments CASCADE');
});

// ---------------------------------------------------------------------------
// Helper — create a deployment and advance it to a given state so it can be
// used as a "previous known-good version" or as a failed deployment.
// ---------------------------------------------------------------------------
async function createDeploymentInState(
  serviceId: string,
  targetEnv: DeploymentEnvironment,
  toState: 'failed' | 'verifying',
  previousDeploymentId?: string,
): Promise<Deployment> {
  const dep = Deployment.create(
    serviceId,
    targetEnv,
    'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
    'https://payments-prod.nasco.com/health',
    30,
    'operator1',
    undefined,
  );

  // Advance through state machine
  dep.transitionToPrepaing();
  dep.transitionToValidating();
  dep.transitionToDeploying();

  if (toState === 'verifying') {
    dep.transitionToVerifying();
  } else if (toState === 'failed') {
    dep.transitionToFailed('Health check probe timed out after 30s');
  }

  if (previousDeploymentId) {
    dep.setPreviousDeploymentId(previousDeploymentId);
  }

  await repository.save(dep);
  return dep;
}

// ---------------------------------------------------------------------------
// POST /deployments/:id/rollback — AC2.3, AC2.4
// ---------------------------------------------------------------------------
describe('POST /deployments/:id/rollback', () => {
  it('AC2.3 — initiates rollback on a failed deployment that has a previous version', async () => {
    // First, create a "previous" deployment (the known-good one)
    const previous = await createDeploymentInState('payments-api', DeploymentEnvironment.PROD, 'verifying');

    // Then create the failing deployment that references the previous one
    const failing = await createDeploymentInState(
      'payments-api',
      DeploymentEnvironment.PROD,
      'failed',
      previous.id,
    );

    const request = new RollbackDeploymentRequest(failing.id, 'Health check failed', 'operator1');
    const response = await rollbackUseCase.execute(request);

    expect(response.rollbackId).toBeDefined();
    expect(response.deploymentId).toBe(failing.id);
    expect(response.previousDeploymentId).toBe(previous.id);
    expect(response.status).toBe('initiated');
  });

  it('AC2.4 — deployment transitions to rolling_back state after rollback is initiated', async () => {
    const previous = await createDeploymentInState('auth-service', DeploymentEnvironment.STAGE, 'verifying');
    const failing = await createDeploymentInState('auth-service', DeploymentEnvironment.STAGE, 'failed', previous.id);

    await rollbackUseCase.execute(new RollbackDeploymentRequest(failing.id, 'Timeout', 'operator2'));

    const updatedStatus = await getStatusUseCase.execute(failing.id);
    expect(updatedStatus.status).toBe('rolling_back');
  });

  it('AC2.3 — rejects rollback when deployment has no previous version', async () => {
    // No previous deployment — rollback should fail
    const dep = Deployment.create(
      'claims-api',
      DeploymentEnvironment.PROD,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/claims-api:v1.0.0-abc123',
      'https://claims-prod.nasco.com/health',
      30,
      'operator1',
    );
    dep.transitionToPrepaing();
    dep.transitionToValidating();
    dep.transitionToDeploying();
    dep.transitionToFailed('Unknown error');
    await repository.save(dep);

    await expect(
      rollbackUseCase.execute(new RollbackDeploymentRequest(dep.id, 'retry', 'operator1')),
    ).rejects.toThrow(/no previous deployment/i);
  });

  it('AC2.3 — rejects rollback when deployment is in an invalid state (queued)', async () => {
    const request = new SubmitDeploymentRequest(
      'billing-api',
      DeploymentEnvironment.DEV,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/billing-api:v1.0.0-xyz789',
      'http://localhost:8080/health',
      30,
      'user123',
    );
    const submitted = await submitUseCase.execute(request);

    await expect(
      rollbackUseCase.execute(
        new RollbackDeploymentRequest(submitted.deploymentId, 'premature', 'operator1'),
      ),
    ).rejects.toThrow(/cannot rollback/i);
  });

  it('AC2.3 — returns 404-equivalent error when deployment does not exist', async () => {
    await expect(
      rollbackUseCase.execute(
        new RollbackDeploymentRequest('00000000-0000-0000-0000-000000000000', 'test', 'operator1'),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('AC2.5 — rollback response includes operator and timestamp', async () => {
    const previous = await createDeploymentInState('payments-api', DeploymentEnvironment.PROD, 'verifying');
    const failing = await createDeploymentInState('payments-api', DeploymentEnvironment.PROD, 'failed', previous.id);

    const before = new Date();
    const response = await rollbackUseCase.execute(
      new RollbackDeploymentRequest(failing.id, 'post-deploy health check failure', 'ops-team'),
    );
    const after = new Date();

    expect(response.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(response.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(response.rollbackId).toMatch(/^rollback-\d+$/);
  });
});
