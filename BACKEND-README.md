# Deploy-Hub Backend Service

Production-ready deployment orchestration backend built with TypeScript, NestJS, and PostgreSQL.

## Features

- **Clean Architecture:** Strict separation of concerns across entities, use-cases, adapters, and frameworks
- **Finite State Machine:** Robust deployment state management with validated transitions
- **TDD Approach:** Comprehensive unit and integration tests with >70% coverage
- **PostgreSQL:** Immutable append-only event log pattern for audit trail
- **API Contracts:** OpenAPI-compliant REST endpoints matching published contracts
- **Health Checks:** Liveness and readiness probes for Kubernetes/ECS

## Quick Start

### Prerequisites

- Node.js 20.x
- PostgreSQL 15+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Update DATABASE_URL if needed
# DATABASE_URL=postgresql://deploy_hub:deploy_hub@localhost:5432/deploy_hub
```

### Development

```bash
# Start development server
npm run dev

# Watch mode
npm run build:watch

# Database migrations
npm run db:migrate
```

### Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests (requires PostgreSQL)
npm run test:integration

# Watch mode
npm run test:watch
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check format
npm run format:check
```

### Building

```bash
# Build TypeScript
npm run build

# Build and start
npm run build
npm start
```

## Architecture

### Clean Architecture Layers

```
src/
├── entities/                    # Business rules - NO external dependencies
│   ├── Deployment.ts           # Core deployment entity + FSM
│   ├── DeploymentStateMachine.ts
│   ├── DeploymentStage.ts       # Immutable stage records
│   └── ServiceConfig.ts
├── use-cases/                   # Application logic - depends only on entities
│   ├── submission/SubmitDeploymentUseCase.ts
│   ├── status/GetDeploymentStatusUseCase.ts
│   ├── status/GetDeploymentStagesUseCase.ts
│   └── rollback/RollbackDeploymentUseCase.ts
├── interface-adapters/          # Request/response mapping
│   ├── controllers/DeploymentController.ts
│   ├── controllers/HealthController.ts
│   ├── repositories/PostgresDeploymentRepository.ts
│   └── presenters/DeploymentPresenter.ts
├── frameworks/                  # NestJS, ORM, AWS SDK
│   ├── db/PostgresConnection.ts
│   ├── db/migrations/V1__Create_deployments_table.sql
│   └── app.module.ts
├── common/
│   ├── errors/DeploymentError.ts
│   └── logging/Logger.ts
└── config/environment.ts
```

### Dependency Rule

Source-code dependencies **always point inward:**

```
Entities ← Use-Cases ← Interface-Adapters ← Frameworks
```

No file in `entities/` or `use-cases/` may import from `interface-adapters/` or `frameworks/`.

## API Endpoints

### Deployment Submission

```
POST /deployments
Content-Type: application/json

{
  "service_id": "payments-api",
  "target_env": "prod",
  "artifact_url": "ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/payments-api:v2.4.1-a3f1c2b",
  "health_check_url": "https://payments-prod.nasco.com/health",
  "health_check_timeout_seconds": 30,
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440000"
}

Response: 201 Created
{
  "deployment_id": "d4c91d08-6b8f-4e2a-9c1b-2f8e7d9c1a4b",
  "status": "queued",
  "progress": 0,
  ...
}
```

### Deployment Status

```
GET /deployments/{deployment_id}

Response: 200 OK
{
  "deployment_id": "d4c91d08-6b8f-4e2a-9c1b-2f8e7d9c1a4b",
  "status": "validating",
  "progress": 40,
  "current_stage": "validate",
  "updated_at": "2026-05-21T14:32:15Z"
}
```

### Deployment Stages

```
GET /deployments/{deployment_id}/stages

Response: 200 OK
{
  "deployment_id": "d4c91d08-6b8f-4e2a-9c1b-2f8e7d9c1a4b",
  "stages": [
    {
      "stage_name": "prepare",
      "status": "complete",
      "started_at": "2026-05-21T14:31:30Z",
      "completed_at": "2026-05-21T14:31:45Z",
      "duration_ms": 15000
    },
    ...
  ]
}
```

### Health Checks

```
GET /health         # Liveness probe
GET /health/ready   # Readiness probe
```

## Database Schema

### Deployments Table

```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY,
  service_id VARCHAR(20) NOT NULL,
  target_env VARCHAR(10) NOT NULL,
  artifact_url VARCHAR(256) NOT NULL,
  health_check_url VARCHAR(256) NOT NULL,
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
```

### Deployment Stages Table

```sql
CREATE TABLE deployment_stages (
  id UUID PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  stage_name VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  error_message VARCHAR(512),
  attempt INTEGER NOT NULL DEFAULT 1
);
```

## State Machine

```
QUEUED → PREPARING → VALIDATING → DEPLOYING → VERIFYING → COMPLETE
  ↓          ↓            ↓           ↓           ↓
FAILED ←────────────────────────────────────────────

VERIFYING → ROLLING_BACK → ROLLED_BACK
              ↓
           FAILED
```

## Test Coverage

- **Unit Tests:** 70%+ coverage on business logic
  - Entity state transitions
  - Use-case validation
  - Presenter mapping
- **Integration Tests:** End-to-end happy paths with Testcontainers
  - Real PostgreSQL database
  - Actual repository operations
  - Full request/response cycle

## Deployment

### Docker

```bash
# Build image
docker build -t deploy-hub:latest .

# Run locally
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://localhost:5432/deploy_hub \
  deploy-hub:latest
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deploy-hub
spec:
  replicas: 2
  selector:
    matchLabels:
      app: deploy-hub
  template:
    metadata:
      labels:
        app: deploy-hub
    spec:
      containers:
      - name: deploy-hub
        image: deploy-hub:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: deploy-hub-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### AWS ECS

See `infra/` directory for Terraform configuration.

## Environment Variables

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/deploy_hub
LOG_LEVEL=info
AWS_REGION=us-east-1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Performance

- **Status API SLA:** <100ms (typical: 10-50ms)
- **Submission API:** <500ms (includes validation and database write)
- **Database:** Indexed queries on service_id, status, created_at
- **Connection Pool:** Max 20 connections, idle timeout 30s

## Monitoring

- OpenTelemetry instrumentation (metrics, traces)
- Structured JSON logging
- Prometheus metrics export
- Grafana dashboards (see `docs/observability/`)

## Contributing

1. Create feature branch: `git checkout -b feat(billing): new-feature`
2. Write tests first (TDD): `npm test`
3. Implement feature
4. Ensure 70%+ coverage: `npm run test:coverage`
5. Lint and format: `npm run lint:fix && npm run format`
6. Commit with conventional message: `git commit -m "feat(billing): add new feature"`
7. Push and open PR

## License

Proprietary - NASCO Platform Engineering Team
