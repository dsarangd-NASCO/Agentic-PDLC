import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresConnection } from '../../../src/frameworks/db/PostgresConnection';
import { PostgresDeploymentRepository } from '../../../src/interface-adapters/repositories/PostgresDeploymentRepository';
import { SubmitDeploymentUseCase } from '../../../src/use-cases/submission/SubmitDeploymentUseCase';
import { SubmitDeploymentRequest } from '../../../src/use-cases/submission/SubmitDeploymentUseCase';
import { GetDeploymentStatusUseCase } from '../../../src/use-cases/status/GetDeploymentStatusUseCase';
import { Deployment, DeploymentEnvironment } from '../../../src/entities/Deployment';

describe('Deployment Submission Integration Test', () => {
  let container: StartedPostgreSqlContainer;
  let postgres: PostgresConnection;
  let repository: PostgresDeploymentRepository;
  let submitUseCase: SubmitDeploymentUseCase;
  let getStatusUseCase: GetDeploymentStatusUseCase;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer()
      .withDatabase('deploy_hub_test')
      .withUsername('test_user')
      .withUserPassword('test_password')
      .start();

    // Initialize connection
    const connectionString = container.getConnectionUri();
    postgres = new PostgresConnection(connectionString);
    await postgres.connect();

    // Create schema
    await postgres.query(`
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
    `);

    // Initialize use cases
    repository = new PostgresDeploymentRepository(postgres);
    submitUseCase = new SubmitDeploymentUseCase(repository);
    getStatusUseCase = new GetDeploymentStatusUseCase(repository);
  });

  afterAll(async () => {
    await postgres.close();
    await container.stop();
  });

  it('should submit deployment and retrieve it', async () => {
    const request = new SubmitDeploymentRequest(
      'payments-api',
      DeploymentEnvironment.PROD,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b',
      'https://payments-prod.nasco.com/health',
      30,
      'user123',
    );

    // Submit deployment
    const response = await submitUseCase.execute(request);

    expect(response.deploymentId).toBeDefined();
    expect(response.status).toBe('queued');

    // Retrieve deployment
    const status = await getStatusUseCase.execute(response.deploymentId);

    expect(status.deploymentId).toBe(response.deploymentId);
    expect(status.status).toBe('queued');
    expect(status.progress).toBe(0);
  });

  it('should support idempotent submission', async () => {
    const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

    const request1 = new SubmitDeploymentRequest(
      'auth-service',
      DeploymentEnvironment.STAGE,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/auth-service:v1.0.0-abc123',
      'https://auth-stage.nasco.com/health',
      30,
      'user123',
      idempotencyKey,
    );

    const response1 = await submitUseCase.execute(request1);

    // Submit identical request with same idempotency key
    const response2 = await submitUseCase.execute(request1);

    // Should return same deployment ID
    expect(response2.deploymentId).toBe(response1.deploymentId);
    expect(response2.status).toBe(response1.status);
  });

  it('should persist deployment transitions', async () => {
    const request = new SubmitDeploymentRequest(
      'billing-api',
      DeploymentEnvironment.DEV,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/billing-api:v1.5.0-xyz789',
      'https://billing-dev.nasco.com/health',
      30,
      'user123',
    );

    const response = await submitUseCase.execute(request);
    const deploymentId = response.deploymentId;

    // Retrieve and verify initial state
    const initial = await repository.getById(deploymentId);
    expect(initial?.getStatus()).toBe('queued');

    // Transition state
    initial?.transitionToPrepaing();
    await repository.save(initial!);

    // Retrieve and verify updated state
    const updated = await repository.getById(deploymentId);
    expect(updated?.getStatus()).toBe('preparing');
    expect(updated?.getProgress()).toBe(20);
  });

  it('should query deployments by service ID', async () => {
    const serviceId = 'notification-service';

    // Submit multiple deployments
    for (let i = 0; i < 3; i++) {
      const request = new SubmitDeploymentRequest(
        serviceId,
        DeploymentEnvironment.PROD,
        `ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/${serviceId}:v1.0.${i}`,
        'https://notifications.nasco.com/health',
        30,
        `user${i}`,
      );

      await submitUseCase.execute(request);
    }

    // Query by service ID
    const deployments = await repository.findByServiceId(serviceId);

    expect(deployments.length).toBeGreaterThanOrEqual(3);
    expect(deployments.every((d) => d.serviceId === serviceId)).toBe(true);
  });

  it('should handle deployment failure scenarios', async () => {
    const request = new SubmitDeploymentRequest(
      'test-service',
      DeploymentEnvironment.STAGE,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/test-service:v1.0.0-test',
      'https://test-stage.nasco.com/health',
      30,
      'user123',
    );

    const response = await submitUseCase.execute(request);
    const deployment = await repository.getById(response.deploymentId);

    // Simulate deployment failure
    deployment?.transitionToPrepaing();
    deployment?.transitionToFailed('Artifact not found in registry');
    await repository.save(deployment!);

    // Verify failure state
    const failed = await repository.getById(response.deploymentId);
    expect(failed?.getStatus()).toBe('failed');
    expect(failed?.getErrorMessage()).toBe('Artifact not found in registry');
    expect(failed?.getCompletedAt()).toBeDefined();
  });

  it('should support full happy path with status queries', async () => {
    const request = new SubmitDeploymentRequest(
      'search-api',
      DeploymentEnvironment.PROD,
      'ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/search-api:v2.1.0-hash123',
      'https://search-prod.nasco.com/health',
      30,
      'user123',
    );

    // Submit
    const submitResponse = await submitUseCase.execute(request);
    expect(submitResponse.status).toBe('queued');

    // Progress through states
    const deployment = await repository.getById(submitResponse.deploymentId);
    const stages = ['PREPARING', 'VALIDATING', 'DEPLOYING', 'VERIFYING', 'COMPLETE'];

    for (const stage of stages) {
      if (stage === 'PREPARING') deployment?.transitionToPrepaing();
      if (stage === 'VALIDATING') deployment?.transitionToValidating();
      if (stage === 'DEPLOYING') deployment?.transitionToDeploying();
      if (stage === 'VERIFYING') deployment?.transitionToVerifying();
      if (stage === 'COMPLETE') deployment?.transitionToComplete();

      await repository.save(deployment!);

      // Query status at each stage
      const status = await getStatusUseCase.execute(submitResponse.deploymentId);
      expect(status.status).toBeDefined();
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
    }
  });
});
