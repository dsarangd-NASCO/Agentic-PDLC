# OpenTelemetry Instrumentation Guide — deploy-hub

**Version:** 1.0.0  
**Date:** 2026-05-21  
**Target:** NestJS backend (Phase 1 MVP)  
**Standards:** OpenTelemetry semantic conventions v1.21.0 + Prometheus remote write  

---

## Overview

This document specifies the observability instrumentation required for deploy-hub to meet SLOs, power dashboards, and support incident response. All instrumentation follows OpenTelemetry (OTel) standards for vendor-neutral, semantic consistency.

**Stack:**
- **Instrumentation:** OpenTelemetry SDK for TypeScript/Node.js
- **Exporter:** OTel Collector Exporter (GRPC protocol)
- **Backends:** Prometheus (metrics) + Loki (logs) + Tempo (traces)

**Governance:**
- Instrumentation is non-negotiable for production readiness (Phase 7 gate check)
- Owner: SRE team; reviewed in Phase 7 readiness audit
- Changes to instrumentation require update to this doc + postmortem if metrics missing

---

## Part 1: Distributed Tracing (Traces)

### Trace Context Propagation

**Requirement:** Every HTTP request entering deploy-hub MUST be assigned a trace ID. Trace context flows through all downstream calls (CodeBuild, CodeDeploy, database, etc.) for end-to-end observability.

**Implementation:**

```typescript
// src/frameworks/app.module.ts

import {
  NodeTracerProvider,
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from "@opentelemetry/sdk-node";
import {
  getNodeAutoInstrumentations,
} from "@opentelemetry/auto-instrumentations-node";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

import { Module } from "@nestjs/common";

@Module({
  imports: [],
  providers: [
    {
      provide: "TRACER_PROVIDER",
      useFactory: () => {
        const provider = new NodeTracerProvider();

        // Exporter: OTel Collector → Tempo
        const traceExporter = new OTLPTraceExporter({
          url: process.env.OTEL_COLLECTOR_ENDPOINT || "http://otel-collector:4317",
        });

        provider.addSpanProcessor(new BatchSpanProcessor(traceExporter));

        // Development: also log to console for debugging
        if (process.env.NODE_ENV === "development") {
          provider.addSpanProcessor(new BatchSpanProcessor(new ConsoleSpanExporter()));
        }

        // W3C Trace Context (standard propagation format)
        registerInstrumentations({
          propagator: new W3CTraceContextPropagator(),
        });

        return provider;
      },
    },
  ],
  exports: ["TRACER_PROVIDER"],
})
export class TracingModule {}
```

**Request Span Creation (NestJS Middleware):**

```typescript
// src/frameworks/tracing.middleware.ts

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("deploy-hub-api");

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const span = tracer.startSpan(`HTTP ${req.method}`, {
      attributes: {
        "http.method": req.method,
        "http.url": req.originalUrl,
        "http.target": req.path,
        "http.host": req.hostname,
        "http.scheme": req.protocol,
      },
    });

    res.on("finish", () => {
      span.setAttributes({
        "http.status_code": res.statusCode,
        "http.response_content_length": res.getHeader("content-length"),
      });
      span.end();
    });

    return next();
  }
}
```

**Trace Context Headers (must be captured):**
- Request: `traceparent` (W3C), `x-trace-id` (custom)
- Response: echo `traceparent` header for client reference
- Database: pass trace ID in SQL comment for correlated logging

---

## Part 2: Metrics (Business & Infrastructure)

### Metric Taxonomy

All metrics are auto-prefixed with `deploy_hub_` to avoid collisions.

#### Counter Metrics (Cumulative)

**Deployments Submitted:**
```typescript
const deploymentsSubmittedCounter = meter.createCounter(
  "deploy_hub_deployments_submitted_total",
  {
    description: "Total deployment requests submitted",
  }
);

// Use:
deploymentsSubmittedCounter.add(1, {
  env: "prod",
  service: "payments-api",
  status: "queued",  // initial status
});
```

**Deployments Completed:**
```typescript
const deploymentsCompletedCounter = meter.createCounter(
  "deploy_hub_deployments_completed_total",
  {
    description: "Total deployments reaching terminal state (complete/failed/rolled_back)",
  }
);

// Use:
deploymentsCompletedCounter.add(1, {
  env: "prod",
  status: "complete",  // or "failed" or "rolled_back"
  reason: "health_check_passed",  // or "timeout", "manual_rollback", etc.
});
```

**Rollbacks Triggered:**
```typescript
const rolbacksCounter = meter.createCounter(
  "deploy_hub_rollbacks_total",
  {
    description: "Total rollback operations (manual or automatic)",
  }
);

// Use:
rolbacksCounter.add(1, {
  env: "prod",
  reason: "health_check_failed",  // or "manual_operator" or "timeout"
  trigger: "automatic",  // or "manual"
});
```

**HTTP Requests:**
```typescript
const httpRequestsCounter = meter.createCounter(
  "http_requests_total",
  {
    description: "Total HTTP requests",
  }
);

// Use (in middleware):
httpRequestsCounter.add(1, {
  service: "deploy-hub",
  endpoint: req.path,
  status: res.statusCode,
  method: req.method,
});
```

#### Histogram Metrics (Observations)

**Deployment Duration:**
```typescript
const deploymentDurationHistogram = meter.createHistogram(
  "deploy_hub_deployment_duration_seconds",
  {
    description: "Deployment pipeline duration (from created_at to completed_at)",
    unit: "s",
  }
);

// Use:
const duration = (completedAt - createdAt) / 1000;  // seconds
deploymentDurationHistogram.record(duration, {
  env: "prod",
  status: "complete",  // or "failed"
});
```

**Health Check Latency:**
```typescript
const healthCheckLatencyHistogram = meter.createHistogram(
  "deploy_hub_health_check_duration_seconds",
  {
    description: "Post-deployment health check probe latency",
    unit: "s",
  }
);

// Use:
const latency = (probeEnd - probeStart) / 1000;
healthCheckLatencyHistogram.record(latency, {
  env: "prod",
  result: "success",  // or "timeout" or "failure"
});
```

**Rollback Duration:**
```typescript
const rollbackDurationHistogram = meter.createHistogram(
  "deploy_hub_rollback_duration_seconds",
  {
    description: "Time to complete rollback (from rolling_back to rolled_back state)",
    unit: "s",
  }
);

// Use:
const duration = (rolledBackAt - rollbackStartedAt) / 1000;
rollbackDurationHistogram.record(duration, {
  env: "prod",
  reason: "health_check_failed",
});
```

**Deployment Stage Duration:**
```typescript
const stageHistogram = meter.createHistogram(
  "deploy_hub_deployment_stage_duration_seconds",
  {
    description: "Duration of individual deployment stages",
    unit: "s",
  }
);

// Use:
const stageDuration = (stageEnd - stageStart) / 1000;
stageHistogram.record(stageDuration, {
  env: "prod",
  stage: "validate",  // prepare, validate, deploy, verify, finalize
  result: "success",  // or "failed"
});
```

**HTTP Request Latency:**
```typescript
const httpLatencyHistogram = meter.createHistogram(
  "http_request_duration_seconds",
  {
    description: "HTTP request latency",
    unit: "s",
  }
);

// Use (in middleware):
const latency = (resEnd - reqStart) / 1000;
httpLatencyHistogram.record(latency, {
  service: "deploy-hub",
  endpoint: req.path,
  status: res.statusCode,
});
```

#### Gauge Metrics (Point-in-time)

**Deployment Queue Depth:**
```typescript
const queueDepthGauge = meter.createObservableGauge(
  "deploy_hub_deployment_queue_depth",
  {
    description: "Number of deployments in queue (pending/preparing)",
  }
);

// Registered as observable: meter will call callback on each scrape
queueDepthGauge.addCallback((result) => {
  const queuedCount = await db.query(
    "SELECT COUNT(*) FROM deployments WHERE status IN ('queued', 'preparing')"
  );
  result.observe(queuedCount, { env: "prod" });
});
```

**RDS Connection Pool Usage:**
```typescript
const rdsConnectionsGauge = meter.createObservableGauge(
  "aws_rds_database_connections",
  {
    description: "Active PostgreSQL connections",
  }
);

rdsConnectionsGauge.addCallback((result) => {
  const activeConnections = await db.query(
    "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()"
  );
  result.observe(activeConnections, { instance: "prod-deploy-hub-db" });
});
```

---

## Part 3: Structured Logs

### Log Format

All logs must be JSON (structured) for easy parsing in Loki/ELK.

```typescript
// src/common/logging/Logger.ts

import * as winston from "winston";
import { trace } from "@opentelemetry/api";

export class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.json(),
      defaultMeta: {
        service: "deploy-hub",
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION || "unknown",
      },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "error.log", level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
      ],
    });
  }

  info(message: string, meta?: Record<string, any>) {
    const span = trace.getActiveSpan();
    const traceContext = span ? {
      trace_id: span.spanContext().traceId,
      span_id: span.spanContext().spanId,
    } : {};

    this.logger.info(message, {
      ...traceContext,
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    const span = trace.getActiveSpan();
    const traceContext = span ? {
      trace_id: span.spanContext().traceId,
      span_id: span.spanContext().spanId,
    } : {};

    this.logger.error(message, {
      ...traceContext,
      error: {
        message: error?.message,
        stack: error?.stack,
      },
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Key Log Points

**Deployment Lifecycle:**

```typescript
// src/use-cases/submission/SubmitDeploymentUseCase.ts

export class SubmitDeploymentUseCase {
  async execute(request: DeploymentRequest): Promise<Deployment> {
    const logger = new Logger();

    logger.info("Deployment submission started", {
      service_id: request.service_id,
      target_env: request.target_env,
      artifact_url: request.artifact_url,
    });

    // Validation
    if (!request.service_id) {
      logger.error("Deployment validation failed: missing service_id", undefined, {
        error_code: "INVALID_REQUEST",
        detail: "service_id is required",
      });
      throw new ValidationError("service_id is required");
    }

    // Create deployment
    const deployment = await this.deploymentRepository.create({
      service_id: request.service_id,
      target_env: request.target_env,
      artifact_url: request.artifact_url,
      health_check_url: request.health_check_url,
      status: DeploymentStatus.QUEUED,
    });

    logger.info("Deployment queued", {
      deployment_id: deployment.id,
      queue_position: await this.getQueuePosition(deployment.id),
    });

    return deployment;
  }
}
```

**Health Check Events:**

```typescript
// src/frameworks/health-check/HealthCheckService.ts

export class HealthCheckService {
  async probeHealth(deploymentId: string, healthCheckUrl: string): Promise<boolean> {
    const logger = new Logger();
    const startTime = Date.now();

    logger.info("Health check probe started", {
      deployment_id: deploymentId,
      health_check_url: healthCheckUrl,
    });

    try {
      const response = await fetch(healthCheckUrl, {
        timeout: 30000,  // 30 seconds per attempt
      });

      const latency = Date.now() - startTime;

      if (response.status === 200) {
        logger.info("Health check passed", {
          deployment_id: deploymentId,
          status_code: response.status,
          latency_ms: latency,
        });
        return true;
      } else {
        logger.warn("Health check returned non-200 status", {
          deployment_id: deploymentId,
          status_code: response.status,
          latency_ms: latency,
        });
        return false;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error("Health check probe failed", error as Error, {
        deployment_id: deploymentId,
        latency_ms: latency,
        error_code: "HEALTH_CHECK_TIMEOUT",
      });
      return false;
    }
  }
}
```

**State Transitions:**

```typescript
// src/use-cases/status/GetDeploymentStatusUseCase.ts

export class DeploymentStateMachine {
  async transitionState(
    deployment: Deployment,
    targetStatus: DeploymentStatus
  ): Promise<void> {
    const logger = new Logger();

    // Validate transition (state machine rules)
    if (!this.isValidTransition(deployment.status, targetStatus)) {
      logger.error(
        `Invalid state transition: ${deployment.status} → ${targetStatus}`,
        undefined,
        {
          deployment_id: deployment.id,
          current_status: deployment.status,
          requested_status: targetStatus,
          error_code: "INVALID_TRANSITION",
        }
      );
      throw new InvalidStateTransitionError(
        `Cannot transition from ${deployment.status} to ${targetStatus}`
      );
    }

    logger.info("Deployment state transition", {
      deployment_id: deployment.id,
      from_status: deployment.status,
      to_status: targetStatus,
      timestamp: new Date().toISOString(),
    });

    deployment.status = targetStatus;
    deployment.updated_at = new Date();
    await this.deploymentRepository.update(deployment);
  }
}
```

---

## Part 4: Integration with Use Cases

### SubmitDeploymentUseCase — Trace + Metrics

```typescript
// src/use-cases/submission/SubmitDeploymentUseCase.ts

import { trace, metrics } from "@opentelemetry/api";

export class SubmitDeploymentUseCase {
  private tracer = trace.getTracer("deploy-hub");
  private meter = metrics.getMeter("deploy-hub");

  // Counters
  private deploymentsSubmittedCounter = this.meter.createCounter(
    "deploy_hub_deployments_submitted_total"
  );

  async execute(request: DeploymentRequest): Promise<Deployment> {
    const span = this.tracer.startSpan("SubmitDeploymentUseCase.execute", {
      attributes: {
        service_id: request.service_id,
        target_env: request.target_env,
      },
    });

    try {
      // Validation span
      const validationSpan = this.tracer.startSpan("validate_request", {
        parent: span,
      });
      try {
        this.validateRequest(request);
        validationSpan.end();
      } catch (error) {
        validationSpan.recordException(error as Error);
        validationSpan.setStatus({ code: 2 });  // ERROR
        validationSpan.end();
        throw error;
      }

      // Create deployment
      const creationSpan = this.tracer.startSpan("create_deployment", {
        parent: span,
      });
      const deployment = await this.deploymentRepository.create({
        service_id: request.service_id,
        target_env: request.target_env,
        artifact_url: request.artifact_url,
        health_check_url: request.health_check_url,
        status: DeploymentStatus.QUEUED,
      });
      creationSpan.end();

      // Emit metric
      this.deploymentsSubmittedCounter.add(1, {
        env: request.target_env,
        service: request.service_id,
      });

      return deployment;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2 });  // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Orchestrator — Stage Metrics

```typescript
// src/use-cases/orchestration/DeploymentOrchestrator.ts

export class DeploymentOrchestrator {
  private tracer = trace.getTracer("deploy-hub-orchestrator");
  private meter = metrics.getMeter("deploy-hub");

  private stageHistogram = this.meter.createHistogram(
    "deploy_hub_deployment_stage_duration_seconds"
  );

  async executeStage(deployment: Deployment, stage: DeploymentStage): Promise<void> {
    const span = this.tracer.startSpan(`execute_stage_${stage.name}`, {
      attributes: {
        deployment_id: deployment.id,
        stage: stage.name,
      },
    });

    const startTime = Date.now();

    try {
      switch (stage.name) {
        case "prepare":
          await this.executePrepare(deployment, span);
          break;
        case "validate":
          await this.executeValidate(deployment, span);
          break;
        case "deploy":
          await this.executeDeploy(deployment, span);
          break;
        case "verify":
          await this.executeVerify(deployment, span);
          break;
        case "finalize":
          await this.executeFinalize(deployment, span);
          break;
      }

      // Record success metric
      const duration = (Date.now() - startTime) / 1000;
      this.stageHistogram.record(duration, {
        env: deployment.target_env,
        stage: stage.name,
        result: "success",
      });

      span.setStatus({ code: 0 });  // OK
    } catch (error) {
      // Record failure metric
      const duration = (Date.now() - startTime) / 1000;
      this.stageHistogram.record(duration, {
        env: deployment.target_env,
        stage: stage.name,
        result: "failed",
      });

      span.recordException(error as Error);
      span.setStatus({ code: 2 });  // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
```

---

## Part 5: External Integrations

### CodeBuild Integration — Trace Propagation

```typescript
// src/frameworks/aws/CodeBuildClient.ts

import { CodeBuildClient, StartBuildCommand } from "@aws-sdk/client-codebuild";
import { trace } from "@opentelemetry/api";

export class CodeBuildIntegration {
  private tracer = trace.getTracer("deploy-hub-codebuild");

  async startBuild(deployment: Deployment): Promise<string> {
    const span = this.tracer.startSpan("codebuild_start_build", {
      attributes: {
        deployment_id: deployment.id,
        service_id: deployment.service_id,
      },
    });

    try {
      const client = new CodeBuildClient({ region: "us-east-1" });
      const traceContext = span.spanContext();

      const response = await client.send(
        new StartBuildCommand({
          projectName: `${deployment.target_env}-${deployment.service_id}-validate`,
          environmentVariables: [
            {
              name: "OTEL_TRACE_ID",
              value: traceContext.traceId,
              type: "PLAINTEXT",
            },
            {
              name: "DEPLOYMENT_ID",
              value: deployment.id,
              type: "PLAINTEXT",
            },
          ],
        })
      );

      span.setAttributes({
        build_id: response.build?.id,
        build_arn: response.build?.arn,
      });

      return response.build!.id!;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2 });  // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### Database Queries — Span Events

```typescript
// src/frameworks/db/PostgresConnection.ts

import { trace } from "@opentelemetry/api";

export class PostgresConnection {
  private tracer = trace.getTracer("deploy-hub-postgres");

  async query(sql: string, params?: unknown[]): Promise<any> {
    const span = this.tracer.startSpan("db_query", {
      attributes: {
        "db.system": "postgresql",
        "db.statement": sql.substring(0, 256),  // truncate for safety
        "db.operation": sql.split(/\s+/)[0].toUpperCase(),  // SELECT, INSERT, UPDATE
      },
    });

    const startTime = Date.now();

    try {
      const result = await this.pool.query(sql, params);
      span.addEvent("query_success", {
        "db.rows_affected": result.rowCount || 0,
        "db.duration_ms": Date.now() - startTime,
      });
      return result;
    } catch (error) {
      span.addEvent("query_error", {
        "db.error": (error as Error).message,
        "db.duration_ms": Date.now() - startTime,
      });
      span.recordException(error as Error);
      span.setStatus({ code: 2 });  // ERROR
      throw error;
    } finally {
      span.end();
    }
  }
}
```

---

## Part 6: Deployment Checklist

### Phase 5 Code Review

- [ ] All use cases emit trace spans via `tracer.startSpan()`
- [ ] Request/response middleware captures HTTP span context (headers)
- [ ] Database queries emit spans with `db.operation` attribute
- [ ] External service calls (CodeBuild, CodeDeploy) propagate trace ID
- [ ] Error cases record exception and set span status = ERROR
- [ ] Sensitive data (API keys, passwords, tokens) NOT included in spans/metrics/logs

### Phase 6 Testing

- [ ] Integration test: verify trace context propagates end-to-end
- [ ] Metric test: counters increment correctly on deployment events
- [ ] Log test: logs are JSON-formatted and parseable by Loki
- [ ] Histogram test: deployment duration histogram records correctly
- [ ] Gauge test: queue depth gauge updates on state changes

**Test example:**
```typescript
describe("SubmitDeploymentUseCase", () => {
  it("emits deployment_submitted metric on success", async () => {
    const mockMeter = {
      createCounter: jest.fn().mockReturnValue({
        add: jest.fn(),
      }),
    };

    jest.spyOn(metrics, "getMeter").mockReturnValue(mockMeter);

    const useCase = new SubmitDeploymentUseCase(deploymentRepo);
    const deployment = await useCase.execute(validRequest);

    const counter = (mockMeter.createCounter as jest.Mock).mock.results[0].value;
    expect(counter.add).toHaveBeenCalledWith(1, {
      env: "dev",
      service: "test-service",
    });
  });
});
```

### Phase 7 Production Readiness

- [ ] Prometheus scrape endpoint responding (`GET /metrics`)
- [ ] OTel Collector receiving spans (check collector logs)
- [ ] Grafana dashboard populated with metrics (all 4 panels showing data)
- [ ] Loki receiving logs (query `{service="deploy-hub"}` returns results)
- [ ] Alerts firing correctly on test SLO breach
- [ ] Runbook references dashboard panels and queries (all links valid)

---

## Configuration

### Environment Variables

```bash
# .env (development)
NODE_ENV=development
LOG_LEVEL=debug
OTEL_COLLECTOR_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
PROMETHEUS_PORT=9090
PROMETHEUS_METRICS_PATH=/metrics

# .env (production)
NODE_ENV=production
LOG_LEVEL=info
OTEL_COLLECTOR_ENDPOINT=http://otel-collector.observability.svc.cluster.local:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc
PROMETHEUS_PORT=9090
PROMETHEUS_METRICS_PATH=/metrics
```

### Package.json Dependencies

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.43.0",
    "@opentelemetry/auto-instrumentations-node": "^0.39.1",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.43.0",
    "@opentelemetry/exporter-metrics-otlp-grpc": "^0.43.0",
    "@opentelemetry/sdk-metrics": "^0.43.0",
    "@opentelemetry/instrumentation-http": "^0.43.0",
    "@opentelemetry/instrumentation-pg": "^0.36.1",
    "@opentelemetry/instrumentation-express": "^0.32.2",
    "@opentelemetry/instrumentation-aws-lambda": "^0.37.0",
    "winston": "^3.11.0",
    "prom-client": "^15.0.0"
  }
}
```

---

## References

- **OpenTelemetry Semantic Conventions:** https://opentelemetry.io/docs/specs/semconv/
- **OpenTelemetry JS SDK:** https://github.com/open-telemetry/opentelemetry-js
- **DORA Metrics:** [docs/ops/DORA-BASELINE.md](./DORA-BASELINE.md)
- **SLOs & Alerts:** [docs/ops/RUNBOOK.md](./RUNBOOK.md#slo-definitions)

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Owned By:** SRE Team  
**Next Review:** Phase 6 (Testing)
