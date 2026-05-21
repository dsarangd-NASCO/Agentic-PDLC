import { Deployment, DeploymentStatus, IDeploymentRepository, DeploymentEnvironment } from '@entities/Deployment';
import { DeploymentStage, DeploymentStageName, DeploymentStageStatus } from '@entities/DeploymentStage';
import { PostgresConnection } from '@frameworks/db/PostgresConnection';

interface DeploymentRow {
  id: string;
  service_id: string;
  target_env: string;
  artifact_url: string;
  health_check_url: string;
  health_check_timeout_seconds: number;
  status: string;
  created_at: Date;
  created_by: string;
  updated_at: Date;
  completed_at?: Date;
  error_message?: string;
  previous_deployment_id?: string;
  idempotency_key?: string;
}

interface DeploymentStageRow {
  id: string;
  deployment_id: string;
  stage_name: string;
  status: string;
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  error_message?: string;
  attempt: number;
}

/**
 * PostgreSQL implementation of IDeploymentRepository
 * Handles all deployment persistence operations
 */
export class PostgresDeploymentRepository implements IDeploymentRepository {
  constructor(private postgres: PostgresConnection) {}

  async save(deployment: Deployment): Promise<void> {
    const query = `
      INSERT INTO deployments (
        id, service_id, target_env, artifact_url, health_check_url,
        health_check_timeout_seconds, status, progress, created_at, created_by,
        updated_at, completed_at, error_message, previous_deployment_id, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        status = $7,
        progress = $8,
        updated_at = $11,
        completed_at = $12,
        error_message = $13,
        previous_deployment_id = $14
    `;

    await this.postgres.query(query, [
      deployment.id,
      deployment.serviceId,
      deployment.targetEnv,
      deployment.artifactUrl,
      deployment.healthCheckUrl,
      deployment.healthCheckTimeoutSeconds,
      deployment.getStatus(),
      deployment.getProgress(),
      deployment.createdAt,
      deployment.createdBy,
      deployment.getUpdatedAt(),
      deployment.getCompletedAt(),
      deployment.getErrorMessage() || null,
      deployment.getPreviousDeploymentId() || null,
      deployment.idempotencyKey || null,
    ]);
  }

  async getById(id: string): Promise<Deployment | null> {
    const query = `
      SELECT id, service_id, target_env, artifact_url, health_check_url,
             health_check_timeout_seconds, status, created_at, created_by,
             updated_at, completed_at, error_message, previous_deployment_id, idempotency_key
      FROM deployments
      WHERE id = $1
    `;

    const result = await this.postgres.query<DeploymentRow>(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapRowToDeployment(row);
  }

  async findByServiceId(serviceId: string): Promise<Deployment[]> {
    const query = `
      SELECT id, service_id, target_env, artifact_url, health_check_url,
             health_check_timeout_seconds, status, created_at, created_by,
             updated_at, completed_at, error_message, previous_deployment_id, idempotency_key
      FROM deployments
      WHERE service_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const result = await this.postgres.query<DeploymentRow>(query, [serviceId]);
    return result.rows.map((row) => this.mapRowToDeployment(row));
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Deployment | null> {
    const query = `
      SELECT id, service_id, target_env, artifact_url, health_check_url,
             health_check_timeout_seconds, status, created_at, created_by,
             updated_at, completed_at, error_message, previous_deployment_id, idempotency_key
      FROM deployments
      WHERE idempotency_key = $1
      LIMIT 1
    `;

    const result = await this.postgres.query<DeploymentRow>(query, [idempotencyKey]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDeployment(result.rows[0]);
  }

  async saveStage(stage: DeploymentStage): Promise<void> {
    const query = `
      INSERT INTO deployment_stages (
        id, deployment_id, stage_name, status, started_at,
        completed_at, duration_ms, error_message, attempt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        status = $4,
        completed_at = $6,
        duration_ms = $7,
        error_message = $8
    `;

    await this.postgres.query(query, [
      stage.id,
      stage.deploymentId,
      stage.stageName,
      stage.status,
      stage.startedAt,
      stage.completedAt || null,
      stage.durationMs || null,
      stage.errorMessage || null,
      stage.attempt,
    ]);
  }

  async getStagesByDeploymentId(deploymentId: string): Promise<DeploymentStage[]> {
    const query = `
      SELECT id, deployment_id, stage_name, status, started_at,
             completed_at, duration_ms, error_message, attempt
      FROM deployment_stages
      WHERE deployment_id = $1
      ORDER BY started_at ASC
    `;

    const result = await this.postgres.query<DeploymentStageRow>(query, [
      deploymentId,
    ]);

    return result.rows.map((row) => this.mapRowToDeploymentStage(row));
  }

  private mapRowToDeployment(row: DeploymentRow): Deployment {
    return Deployment.restore(
      row.id,
      row.service_id,
      row.target_env as DeploymentEnvironment,
      row.artifact_url,
      row.health_check_url,
      row.health_check_timeout_seconds,
      row.created_at,
      row.created_by,
      row.status as DeploymentStatus,
      row.updated_at,
      row.idempotency_key,
      row.completed_at,
      row.error_message,
      row.previous_deployment_id,
    );
  }

  private mapRowToDeploymentStage(row: DeploymentStageRow): DeploymentStage {
    return DeploymentStage.restore(
      row.id,
      row.deployment_id,
      row.stage_name as DeploymentStageName,
      row.status as DeploymentStageStatus,
      row.started_at,
      row.completed_at,
      row.duration_ms,
      row.error_message,
      row.attempt,
    );
  }
}
