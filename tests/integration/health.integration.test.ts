/**
 * Integration Tests — Health Check Endpoint
 *
 * Protects:
 *   Story 2 (AC2.2) — Health check probes verify service connectivity
 *   SPEC MVP requirement — Deploy-hub itself must be ≥ 99.5% available
 */
import { describe, it, expect } from 'vitest';
import { HealthController } from '../../src/interface-adapters/controllers/HealthController';

// The HealthController does not depend on a database in its current implementation.
// When DB connectivity checks are added (Sprint 3), upgrade this to a Testcontainers
// test that wires a real PostgresConnection and asserts the "database: ok" check.

describe('GET /health', () => {
  it('AC2.2 — returns healthy status with all checks passing', async () => {
    const controller = new HealthController();
    const result = await controller.healthCheck();

    expect(result.statusCode).toBe(200);
    expect(result.data.status).toBe('healthy');
    expect((result.data as any).checks).toMatchObject({
      database: 'ok',
      codebuild: 'ok',
      codedeploy: 'ok',
    });
  });

  it('AC2.2 — includes uptime_seconds in response', async () => {
    const controller = new HealthController();
    const result = await controller.healthCheck();

    expect((result.data as any).uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('AC2.2 — includes ISO 8601 timestamp in response', async () => {
    const controller = new HealthController();
    const result = await controller.healthCheck();

    const ts = (result.data as any).timestamp;
    expect(ts).toBeDefined();
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe('GET /health/ready', () => {
  it('returns ready when service is initialized', async () => {
    const controller = new HealthController();
    const result = await controller.readinessCheck();

    expect(result.statusCode).toBe(200);
    expect(result.data.status).toBe('ready');
  });
});
