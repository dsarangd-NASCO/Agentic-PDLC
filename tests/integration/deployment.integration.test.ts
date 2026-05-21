/**
 * Integration Tests — Deployment Submission & Status
 *
 * Protects:
 *   Story 1 (AC1.1) — Submit deployment request via REST API
 *   Story 1 (AC1.2) — Validates request and rejects invalid configs
 *   Story 1 (AC1.3) — State transitions logged with timestamps
 *   Story 1 (AC1.4) — Supports dev, stage, prod environments
 *   Story 2 (AC2.5) — Immutable audit trail per deployment event
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresConnection } from '../../src/frameworks/db/PostgresConnection';
import { PostgresDeploymentRepository } from '../../src/interface-adapters/repositories/PostgresDeploymentRepository';
import { SubmitDeploymentUseCase, SubmitDeploymentRequest } from '../../src/use-cases/submission/SubmitDeploymentUseCase';
import { GetDeploymentStatusUseCase } from '../../src/use-cases/status/GetDeploymentStatusUseCase';
import { DeploymentController } from '../../src/interface-adapters/controllers/DeploymentController';
import { DeploymentEnvironment } from '../../src/entities/Deployment';

// ---------------------------------------------------------------------------
// Schema DDL (mirrors V1__Create_deployments_table.sql)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------
let pgContainer: StartedPostgreSqlContainer;
let postgres: PostgresConnection;
let repository: PostgresDeploymentRepository;
let submitUseCase: SubmitDeploymentUseCase;
let getStatusUseCase: GetDeploymentStatusUseCase;
let controller: DeploymentController;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer()
    .withDatabase('deploy_hub_test')
    .withUsername('test_user')
    .withPassword('test_password')
    .start();

  postgres = new PostgresConnection(pgContainer.getConnectionUri());
  await postgres.connect();
  await postgres.query(SCHEMA_SQL);

  repository = new PostgresDeploymentRepository(postgres);
  submitUseCase = new SubmitDeploymentUseCase(repository);
  getStatusUseCase = new GetDeploymentStatusUseCase(repository);
  controller = new DeploymentController(submitUseCase, getStatusUseCase);
}, 120_000);

afterAll(async () => {
  await postgres.close();
  await pgContainer.stop();
});

beforeEach(async () => {
  // Truncate between tests to keep state clean
  await postgres.query('TRUNCATE TABLE deployment_stages, deployments CASCADE');
});

// ---------------------------------------------------------------------------
// POST /deployments  — AC1.1, AC1.4
// ---------------------------------------------------------------------------
describe('POST /deployments', () => {
  it('AC1.1 — persists a valid deployment and returns queued status', async () => {
    const result = await controller.submitDeployment(
      {
        service_id: 'payments-api',
        target_env: 'prod',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
        health_check_url: 'https://payments-prod.nasco.com/health',
        health_check_timeout_seconds: 30,
      },
      'user123',
    );

    expect(result.statusCode).toBe(201);
    expect(result.data.deployment_id).toBeDefined();
    expect(result.data.status).toBe('queued');
    expect(result.data.service_id).toBe('payments-api');
    expect(result.data.target_env).toBe('prod');

    // Verify persistence — retrieve from DB
    const persisted = await getStatusUseCase.execute(result.data.deployment_id);
    expect(persisted.deploymentId).toBe(result.data.deployment_id);
    expect(persisted.status).toBe('queued');
  });

  it('AC1.4 — accepts dev environment', async () => {
    const result = await controller.submitDeployment(
      {
        service_id: 'auth-service',
        target_env: 'dev',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/auth-service:v1.0.0-abc123',
        health_check_url: 'http://localhost:8080/health',
      },
      'user456',
    );

    expect(result.statusCode).toBe(201);
    expect(result.data.target_env).toBe('dev');
  });

  it('AC1.4 — accepts stage environment', async () => {
    const result = await controller.submitDeployment(
      {
        service_id: 'claims-api',
        target_env: 'stage',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/claims-api:v3.1.0-def456',
        health_check_url: 'https://claims-stage.nasco.com/health',
      },
      'user789',
    );

    expect(result.statusCode).toBe(201);
    expect(result.data.target_env).toBe('stage');
  });

  it('AC1.2 — rejects request missing required fields', async () => {
    await expect(
      controller.submitDeployment(
        {
          service_id: '',
          target_env: 'prod',
          artifact_url: '',
          health_check_url: '',
        },
        'user123',
      ),
    ).rejects.toThrow(/missing required fields/i);
  });

  it('AC1.2 — rejects invalid service_id format', async () => {
    await expect(
      controller.submitDeployment(
        {
          service_id: 'INVALID_SERVICE',
          target_env: 'prod',
          artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/svc:v1.0-abc123',
          health_check_url: 'https://svc-prod.nasco.com/health',
        },
        'user123',
      ),
    ).rejects.toThrow(/invalid service_id/i);
  });

  it('AC1.2 — rejects unknown target environment', async () => {
    await expect(
      controller.submitDeployment(
        {
          service_id: 'payments-api',
          target_env: 'sandbox',
          artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
          health_check_url: 'https://payments-prod.nasco.com/health',
        },
        'user123',
      ),
    ).rejects.toThrow(/invalid target_env/i);
  });

  it('AC2.5 — deployment record includes immutable created_at timestamp', async () => {
    const before = new Date();

    const result = await controller.submitDeployment(
      {
        service_id: 'billing-api',
        target_env: 'stage',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/billing-api:v1.0.0-xyz789',
        health_check_url: 'https://billing-stage.nasco.com/health',
      },
      'operator1',
    );

    const after = new Date();
    const createdAt = new Date(result.data.created_at);

    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

// ---------------------------------------------------------------------------
// GET /deployments/:id  — AC1.3
// ---------------------------------------------------------------------------
describe('GET /deployments/:id', () => {
  it('AC1.3 — returns current deployment state with progress', async () => {
    const submitted = await controller.submitDeployment(
      {
        service_id: 'payments-api',
        target_env: 'prod',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
        health_check_url: 'https://payments-prod.nasco.com/health',
      },
      'user123',
    );

    const status = await getStatusUseCase.execute(submitted.data.deployment_id);

    expect(status.deploymentId).toBe(submitted.data.deployment_id);
    expect(status.status).toBe('queued');
    expect(status.progress).toBe(0);
  });

  it('AC1.3 — returns 404-equivalent error for non-existent deployment', async () => {
    await expect(
      getStatusUseCase.execute('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/not found/i);
  });

  it('AC1.1 idempotency — returns existing deployment when idempotency key already used', async () => {
    const idempotencyKey = '550e8400-e29b-41d4-a716-446655440001';

    const first = await controller.submitDeployment(
      {
        service_id: 'auth-service',
        target_env: 'stage',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/auth-service:v1.0.0-abc123',
        health_check_url: 'https://auth-stage.nasco.com/health',
        idempotency_key: idempotencyKey,
      },
      'user123',
    );

    const second = await controller.submitDeployment(
      {
        service_id: 'auth-service',
        target_env: 'stage',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/auth-service:v1.0.0-abc123',
        health_check_url: 'https://auth-stage.nasco.com/health',
        idempotency_key: idempotencyKey,
      },
      'user123',
    );

    expect(first.data.deployment_id).toBe(second.data.deployment_id);
  });
});

// ---------------------------------------------------------------------------
// GET /deployments  (list)
// ---------------------------------------------------------------------------
describe('GET /deployments', () => {
  it('AC1.1 — deployed services appear in the list query', async () => {
    await controller.submitDeployment(
      {
        service_id: 'payments-api',
        target_env: 'dev',
        artifact_url: 'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
        health_check_url: 'http://localhost:8080/health',
      },
      'user123',
    );

    const deployments = await repository.findByServiceId('payments-api');

    expect(deployments.length).toBeGreaterThanOrEqual(1);
    expect(deployments[0].serviceId).toBe('payments-api');
  });
});
