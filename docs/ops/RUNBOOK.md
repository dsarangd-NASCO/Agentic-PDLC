# Operations Runbook — deploy-hub

**Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Criticality:** High (deployment platform — service outages block release pipelines)  
**Owner:** Platform Engineering Team (@dsarangd-NASCO)  

---

## Table of Contents

1. [Service Overview](#service-overview)
2. [Architecture Quick Reference](#architecture-quick-reference)
3. [SLO Definitions](#slo-definitions)
4. [Incident Severity Tiers](#incident-severity-tiers)
5. [On-Call Rotation](#on-call-rotation)
6. [Alerting and On-Call](#alerting-and-on-call)
7. [Incident Response Playbooks](#incident-response-playbooks)
8. [Recovery Procedures](#recovery-procedures)
9. [Contacts and Escalation](#contacts-and-escalation)
10. [Reference](#reference)

---

## Service Overview

**deploy-hub** is a mission-critical deployment orchestration platform for NASCO's SaaS product portfolio. It automates service deployment pipelines, validates deployment health post-deployment, and provides automatic rollback capability.

**Core responsibilities:**
- Accept deployment requests via REST API (`POST /deployments`)
- Orchestrate deployment stages (prepare → validate → deploy → verify → finalize)
- Execute automated health checks post-deployment
- Trigger automatic rollback on health check failure
- Maintain immutable audit logs of all deployment events

**Runtime:** AWS ECS on EC2 (2 tasks min, 5 max, 70% CPU target)  
**Data store:** PostgreSQL 15+ on RDS (Multi-AZ failover enabled)  
**Observability:** OpenTelemetry → Prometheus + Loki + Tempo + Grafana + Sentry  

**Key Dependencies:**
- AWS CodeBuild (pre-deployment validation)
- AWS CodeDeploy (artifact deployment and traffic cutover)
- Artifact Registry (ECR, S3 artifact storage)
- Target services (exposing `/health` endpoint)

---

## Architecture Quick Reference

**System Diagram:** See [docs/architecture/DESIGN.md](../architecture/DESIGN.md#system-context)

**Container Breakdown:**
| Container | Technology | Criticality | Typical Load |
|---|---|---|---|
| API Server | NestJS 10+ | Critical | 100 req/min rate limit per service |
| Orchestrator | TypeScript State Machine | Critical | 1 concurrent deployment per task |
| Health Check Service | TypeScript | High | 1 health probe per deployment (2 attempts, 30s timeout each) |
| PostgreSQL | PostgreSQL 15+ RDS | Critical | 50 concurrent connections typical |
| Task Queue | In-Memory (MVP) | Medium | Long-running job queue (future: Redis) |
| Metrics Exporter | OpenTelemetry | Medium | Async batch push to Prometheus |

**Key Endpoints:**
- `GET /health` — Liveness probe (returns 200 OK if service is operational)
- `POST /deployments` — Submit deployment request
- `GET /deployments/{id}` — Poll deployment status
- `POST /deployments/{id}/rollback` — Trigger manual rollback
- `GET /metrics` — OpenTelemetry metrics (Prometheus format)

---

## SLO Definitions

### SLO-1: API Availability

**Objective:** deploy-hub REST API is available and responsive to deployment requests and status queries.

| Metric | Value |
|---|---|
| **SLI** | Successful HTTP responses (2xx, 3xx) on `POST /deployments`, `GET /deployments/:id`, `POST /deployments/:id/rollback` |
| **Target** | 99.5% success rate over rolling 30 days |
| **Error Budget** | 216 minutes/month (~3.6 hours) |
| **Burn Rate Alerts** | See [Alert: SLOBurnRateHigh](#alert-slioburnatehigh-1h-window) and [Alert: SLOBurnRateCritical](#alert-slioburnatecritical-6h-window) |
| **Dashboard** | [Grafana: deploy-hub Golden Signals](#four-golden-signals-dashboard) — Errors panel |

**Rationale:** 99.5% reflects that deploy-hub is a critical platform service but not customer-facing (deployment failures fall back to manual SSH deployment). 216 min/month error budget allows for ~1 major incident or 3 minor incidents per month while staying within SLO.

**Associated Test Cases:** See [docs/qa/QA-REPORT.md](../qa/QA-REPORT.md) for API acceptance tests.

---

### SLO-2: Deployment Pipeline Duration

**Objective:** Deployments complete within the acceptance criteria timeframe, ensuring teams can ship on schedule.

| Metric | Value |
|---|---|
| **SLI** | Percentage of deployments (from `created_at` to `completed_at`) completing within 45 minutes |
| **Target** | 95% of deployments complete within 45 minutes |
| **Error Budget** | 5% of deployments can exceed 45 minutes |
| **Burn Rate Alerts** | See [Alert: DeploymentPipelineTimeout](#alert-deploymentpipelinetimeout) |
| **Dashboard** | [Grafana: deploy-hub Golden Signals](#four-golden-signals-dashboard) — Latency panel (histogram: p50, p95, p99) |
| **Source Document** | [docs/spec/SPEC.md](../spec/SPEC.md) — AC-1.5 |

**Rationale:** AC-1.5 requires < 45 minutes for standard deployments. 95% target allows 5% of deployments (e.g., due to resource contention or large artifacts) to exceed the deadline while maintaining reliable, predictable deployments. Error budget over 30 days: ~1.5 days of "slow" deployments.

**Failure Mode:** Deployments exceeding 45 minutes are still valid and may complete successfully; alert for monitoring/debugging, not SLO breach.

---

### SLO-3: Rollback Duration

**Objective:** When a deployment fails health checks or is manually rolled back, service recovery is rapid.

| Metric | Value |
|---|---|
| **SLI** | Percentage of rollbacks (from `rolling_back` state entry to `rolled_back` state) completing within 10 minutes |
| **Target** | 98% of rollbacks complete within 10 minutes |
| **Error Budget** | 2% of rollbacks can exceed 10 minutes (~14.4 hours/month) |
| **Burn Rate Alerts** | See [Alert: RollbackTimeout](#alert-rollbacktimeout) |
| **Dashboard** | [Grafana: deploy-hub Golden Signals](#four-golden-signals-dashboard) — Latency panel (rollback histogram) |
| **Source Document** | [docs/spec/SPEC.md](../spec/SPEC.md) — AC-2.4 |

**Rationale:** AC-2.4 requires ≤ 10 minutes for rollback. 98% target ensures rapid recovery in the vast majority of cases. Error budget: ~14.4 hours/month, allowing for occasional slow rollbacks due to artifact caching or infrastructure issues.

---

### SLO-4: Health Check Latency

**Objective:** Post-deployment health checks complete quickly, ensuring teams get rapid feedback on deployment success.

| Metric | Value |
|---|---|
| **SLI** | p99 latency of health check probes (from `verifying` stage start to health check completion or timeout) |
| **Target** | p99 health check latency ≤ 2 minutes per deployment |
| **Window** | Rolling 30 days |
| **Burn Rate Alerts** | See [Alert: HealthCheckLatencyHigh](#alert-healthchecklatencyhigh) |
| **Dashboard** | [Grafana: deploy-hub Golden Signals](#four-golden-signals-dashboard) — Latency panel (health check histogram) |
| **Source Document** | [docs/spec/SPEC.md](../spec/SPEC.md) — AC-2.2 |

**Rationale:** AC-2.2 requires health checks within 2 minutes. This SLO ensures rapid feedback on deployment health. p99 target accounts for transient network delays or service startup latency while maintaining predictable health check behavior.

---

## Incident Severity Tiers

| Tier | Definition | MTTA | Escalation | Example |
|---|---|---|---|---|
| **SEV-1** | Platform completely down; all deployments blocked; no fallback available | ≤ 5 min | Page primary + secondary on-call immediately; notify Platform Head | deploy-hub API crashes, database unavailable, no manual SSH access |
| **SEV-2** | Degraded state; some deployments possible but error rate > 5% or specific features unavailable (rollback, health checks) | ≤ 15 min | Page primary on-call; wake secondary if unresolved in 10 min | 10% of `POST /deployments` requests fail, health check service down |
| **SEV-3** | SLO burn rate elevated but not critical; latency degraded or approaching SLO breach | ≤ 1 hr | Create incident ticket; notify on-call for context but non-blocking page | p99 deployment latency at 35 min (within SLO but trending high), single endpoint slow |
| **SEV-4** | Informational; non-blocking issue; single user impact or low-risk condition | Next business day | Document in ticket; no page required | Deployment takes 44 min (within 45-min target), single failed health check (auto-recovered) |

---

## On-Call Rotation

| Role | Name/Team | Coverage | Escalation |
|---|---|---|---|
| **Primary On-Call** | TBD (rotate weekly) | 24/7 — pages for SEV-1 and SEV-2 | Escalate SEV-1 to Platform Head after 15 min |
| **Secondary On-Call** | TBD (rotate weekly) | 24/7 backup — pages if primary unavailable or SEV-1 persists > 10 min | Secondary escalates to Platform Head |
| **Platform Head** | TBD (on-call rotation coordinator) | SEV-0/SEV-1 escalations only — business hours default | Follow organizational escalation policy |

**Rotation schedule:** Weekly, starting Monday 00:00 UTC. Handoff: Friday 23:59 UTC.

**On-Call Acknowledgment SLA:**
- SEV-1: Acknowledge within 5 minutes; if unacknowledged, page secondary
- SEV-2: Acknowledge within 15 minutes; if unacknowledged, escalate to Platform Head
- SEV-3: Acknowledge within 1 hour (best-effort, may be async)

---

## Alerting and On-Call

### Alert Routing

All alerts route to:
- **Primary channel:** `#deploy-hub-incidents` Slack channel (PagerDuty integration enabled)
- **Pages:** PagerDuty → primary on-call (SMS + phone call for SEV-1)
- **Escalation:** Automatic to secondary after 10 min no-ack (SEV-1 only)

### Four Golden Signals Dashboard

**Grafana Dashboard:** `deploy-hub-golden-signals` (access at [grafana.nasco.com/d/deploy-hub-golden-signals](https://grafana.nasco.com/d/deploy-hub-golden-signals))

#### 1. Latency — Deployment Duration Histogram

**Panels:**
- `p50, p95, p99 deployment duration (minutes)` — histogram of time from `created_at` to `completed_at` across all deployments
  - Y-axis: Count of deployments
  - X-axis: Duration (minutes)
  - Overlaid line: 45-minute SLO target (red)
- `Rollback duration (minutes)` — p50, p95, p99 of time from `rolling_back` state to `rolled_back` state
  - Overlaid line: 10-minute SLO target (red)
- `Health check latency (seconds)` — p50, p95, p99 of health probe response time
  - Overlaid line: 120-second (2-minute) SLO target (red)

**Prometheus Query Examples:**
```promql
# P99 deployment duration
histogram_quantile(0.99, rate(deploy_hub_deployment_duration_seconds_bucket[5m])) / 60

# P95 deployment duration
histogram_quantile(0.95, rate(deploy_hub_deployment_duration_seconds_bucket[5m])) / 60

# P99 rollback duration
histogram_quantile(0.99, rate(deploy_hub_rollback_duration_seconds_bucket[5m])) / 60

# P99 health check latency
histogram_quantile(0.99, rate(deploy_hub_health_check_duration_seconds_bucket[5m]))
```

**Alert Thresholds:**
- p99 deployment duration > 40 minutes → `DeploymentLatencyHigh` (warning)
- p99 deployment duration > 50 minutes → `DeploymentLatencyVeryHigh` (critical)
- p99 rollback duration > 9 minutes → `RollbackLatencyHigh` (warning)

---

#### 2. Traffic — Request Rate and Status Codes

**Panels:**
- `Requests per second by endpoint` — stacked area chart
  - Lines: `POST /deployments`, `GET /deployments/{id}`, `POST /deployments/{id}/rollback`, `GET /health`
  - Y-axis: req/sec
  - Breakdown by HTTP status: 2xx (green), 3xx (blue), 4xx (yellow), 5xx (red)
- `Request rate by status code` — bar chart
  - Status codes: 200, 202, 400, 401, 429, 500, 502, 503
- `Rate limiting: requests hitting 429 (too many)` — trend over time
  - Y-axis: count of 429 responses/min
  - Alert threshold: > 10 per minute (indicates capacity pressure)

**Prometheus Query Examples:**
```promql
# Request rate per endpoint
rate(http_requests_total{service="deploy_hub",endpoint=~"/deployments.*"}[5m])

# Error rate (5xx / total)
rate(http_requests_total{service="deploy_hub",status=~"5.."}[5m])
/ ignoring(status)
rate(http_requests_total{service="deploy_hub"}[5m])

# Rate limit hits (429s)
rate(http_requests_total{service="deploy_hub",status="429"}[5m])
```

---

#### 3. Errors — HTTP 5xx Rate and Error Types

**Panels:**
- `Error rate (5xx / total) by endpoint` — line chart
  - Lines: `POST /deployments`, `GET /deployments/{id}`, `POST /deployments/{id}/rollback`
  - Y-axis: % error rate (0–100%)
  - Alert line: 5% (SLO burn rate threshold for 1-hour window)
- `HTTP 5xx count over time` — bar chart by status
  - Breakdown: 500, 502, 503, 504
- `Top error messages` — table showing most common error reasons
  - Columns: Error Type, Count, First Seen, Last Seen

**Prometheus Query Examples:**
```promql
# Error rate for SLO
rate(http_requests_total{service="deploy_hub",status=~"5.."}[5m])
/ ignoring(status)
rate(http_requests_total{service="deploy_hub"}[5m])

# 5xx count
increase(http_requests_total{service="deploy_hub",status=~"5.."}[1h])

# Errors by type (from logs)
# Requires Loki integration — query top error message strings
```

---

#### 4. Saturation — Infrastructure Utilization

**Panels:**
- `ECS CPU utilization (%)` — gauge or time-series
  - Current % and trend
  - Red zone: > 85%
  - Target: 70% (auto-scaling trigger at this threshold)
- `ECS memory utilization (%)` — gauge
  - Current % and trend
  - Red zone: > 90%
- `RDS PostgreSQL connections` — stacked area
  - Lines: Active connections, Idle connections
  - Y-axis: count
  - Max threshold line: 95 (db.t3.small max; scale up if approaching)
- `RDS storage utilization (%)` — gauge
  - Current % and trend
  - Red zone: > 80%
- `Deployment queue depth` — line chart
  - Y-axis: count of queued deployments
  - Alert threshold: > 5 (indicates processing bottleneck)

**Prometheus Query Examples:**
```promql
# ECS CPU %
100 * (aws_ecs_cpu_utilization{cluster="prod-deploy-hub-cluster"})

# RDS active connections
aws_rds_database_connections{instance="prod-deploy-hub-db"}

# Deployment queue depth
deploy_hub_deployment_queue_depth

# Storage %
100 * (aws_rds_free_storage_space{instance="prod-deploy-hub-db"} / aws_rds_allocated_storage{instance="prod-deploy-hub-db"})
```

---

### Critical Alerts

#### Alert: HighErrorRate

**Condition:**
```promql
rate(http_requests_total{service="deploy_hub",status=~"5.."}[5m])
/ ignoring(status)
rate(http_requests_total{service="deploy_hub"}[5m]) > 0.05
```

**Severity:** `warning` (SEV-3) — escalate to `critical` (SEV-2) if sustained > 10 min

**Duration:** 5 minutes

**Annotations:**
```yaml
summary: "deploy-hub error rate elevated ({{ $value | humanizePercentage }})"
description: |
  HTTP 5xx rate exceeds 5% threshold for 5 minutes.
  Service: deploy-hub
  Current rate: {{ $value | humanizePercentage }}
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#incident-sev-2-degraded-state
```

**Response:**
1. Check [HighErrorRate Playbook](#incident-sev-2-degraded-state) below
2. Pull error logs: Loki query `{service="deploy_hub"} |= "error" | json | status > 399` (last 15 min)
3. Check recent deployments on dashboard
4. If error rate not declining, page on-call immediately

---

#### Alert: SLOBurnRateHigh (1-hour window)

**Condition:** Error budget burn rate ≥ 14x in 1-hour window (indicates SLO breach if sustained)

```promql
(
  rate(http_requests_total{service="deploy_hub",status=~"5.."}[1h])
  / ignoring(status)
  rate(http_requests_total{service="deploy_hub"}[1h])
)
> (1 - 0.995) * 14  # 0.005 * 14 = 0.07 (7% error rate = 14x burn)
```

**Severity:** `warning` (SEV-3) — escalate to `critical` (SEV-2) if 2 hours sustained

**Duration:** 1 hour (do not trigger on short blips)

**Annotations:**
```yaml
summary: "deploy-hub SLO burn rate critical (14x nominal) — 1h window"
description: |
  Error budget burning at 14x the nominal rate over 1 hour.
  If sustained for 6 hours, full monthly error budget exhausted.
  Action: Freeze feature work until error budget restored.
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#incident-sev-3-slo-burn-rate-elevated
```

**Response:**
1. Acknowledge alert; do not page if < 2 hours
2. Check error source: recent changes, upstream dependencies, database?
3. If error rate stabilizes, document in postmortem (if SEV-2 level)
4. If sustained > 2 hours → escalate to SEV-2, page on-call

---

#### Alert: SLOBurnRateCritical (6-hour window)

**Condition:** Error budget burn rate ≥ 6x in 6-hour window (SLO will breach if continues)

```promql
(
  rate(http_requests_total{service="deploy_hub",status=~"5.."}[6h])
  / ignoring(status)
  rate(http_requests_total{service="deploy_hub"}[6h])
)
> (1 - 0.995) * 6  # 0.005 * 6 = 0.03 (3% error rate = 6x burn)
```

**Severity:** `critical` (SEV-2) — page on-call immediately

**Duration:** 6 hours (do not trigger on short blips; indicates sustained degradation)

**Annotations:**
```yaml
summary: "🚨 deploy-hub SLO breach imminent — 6h burn rate 6x — PAGE NOW"
description: |
  Error budget burning at 6x nominal rate over 6 hours.
  SLO breach will occur within hours if error rate not reduced.
  Monthly error budget exhaustion will trigger feature work freeze.
  **IMMEDIATE ACTION REQUIRED**
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#incident-sev-2-degraded-state
```

**Response:** See [Incident: SEV-2 Degraded State](#incident-sev-2-degraded-state)

---

#### Alert: DeploymentPipelineTimeout

**Condition:** Percentage of deployments exceeding 45 minutes threshold

```promql
(
  count(deploy_hub_deployment_duration_seconds_bucket{le="2700"})  # 2700s = 45 min
  / count(deploy_hub_deployment_duration_seconds_bucket)
) < 0.95
```

**Severity:** `warning` (SEV-3) — escalate if SLO target breached (< 95% within 45 min)

**Duration:** 1 hour

**Annotations:**
```yaml
summary: "deploy-hub: {{ $value | humanizePercentage }} of deployments complete within 45min SLO"
description: |
  Deployment pipeline duration SLO trending below 95% target.
  Investigate resource saturation or upstream dependencies.
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#alert-deploymentpipelinetimeout
```

**Response:**
1. Check saturation dashboard: ECS CPU, RDS connections, storage
2. Check CodeBuild/CodeDeploy queue depth (AWS Console)
3. If saturation high: scale ECS tasks, increase RDS connections
4. If resource available: investigate slow stages in deployment logs

---

#### Alert: RollbackTimeout

**Condition:** Percentage of rollbacks exceeding 10-minute threshold

```promql
(
  count(deploy_hub_rollback_duration_seconds_bucket{le="600"})  # 600s = 10 min
  / count(deploy_hub_rollback_duration_seconds_bucket)
) < 0.98
```

**Severity:** `warning` (SEV-3) — escalate if SLO target breached (< 98% within 10 min)

**Duration:** 1 hour

**Annotations:**
```yaml
summary: "deploy-hub: {{ $value | humanizePercentage }} of rollbacks complete within 10min SLO"
description: |
  Rollback duration trending slower than SLO target.
  Check CodeDeploy state, artifact caching, service readiness.
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#alert-rollbacktimeout
```

**Response:**
1. Spot-check recent rollbacks: did they succeed? Any infrastructure issues?
2. Check artifact cache hit rate (Prometheus: `deploy_hub_artifact_cache_hit_ratio`)
3. Check previous deployment version availability
4. If issue persists: investigate pre-deployment artifact pull latency

---

#### Alert: HealthCheckLatencyHigh

**Condition:** p99 health check latency exceeds SLO target

```promql
histogram_quantile(0.99, rate(deploy_hub_health_check_duration_seconds_bucket[5m])) > 120
```

**Severity:** `warning` (SEV-3) — early signal of deployment feedback delay

**Duration:** 5 minutes

**Annotations:**
```yaml
summary: "deploy-hub: Health check p99 latency {{ $value }}s (SLO: 120s)"
description: |
  Health check latency trending above 2-minute SLO target.
  May indicate target service startup delay or network latency.
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#alert-healthchecklatencyhigh
```

**Response:**
1. Check target service startup time: are cold-starts slow?
2. Check network latency: any VPC/security group issues?
3. Examine health check endpoint response time (curl from deploy-hub pod)
4. If target service slow: escalate to that team; may be expected (e.g., database migrations)

---

#### Alert: DatabaseConnectionPoolExhausted

**Condition:** Active connections approaching max

```promql
aws_rds_database_connections{instance="prod-deploy-hub-db"} > 85
```

**Severity:** `critical` (SEV-2) — page on-call if connections > 90

**Duration:** 2 minutes

**Annotations:**
```yaml
summary: "deploy-hub RDS: {{ $value }} active connections (max: 95)"
description: |
  PostgreSQL connection pool approaching exhaustion.
  New deployment requests will queue or fail.
  Runbook: https://github.com/org/repo/blob/main/docs/ops/RUNBOOK.md#recovery-database-connection-pool-exhausted
```

**Response:** See [Recovery: Database Connection Pool Exhausted](#recovery-database-connection-pool-exhausted)

---

## Incident Response Playbooks

### Incident: SEV-1 — Service Completely Down

**Detection:**
- Alert fires: `HighErrorRate` > 50% sustained > 5 min, OR
- Manual report: "Cannot submit deployments, API returns 503", OR
- Monitor: ECS tasks all in CRITICAL state, or database unreachable

**Triage Steps (First 5 Minutes):**

1. **Confirm service status:**
   ```bash
   curl -I https://deploy-hub.prod.nasco.com/health
   # Expected: HTTP 200 OK
   # Actual: HTTP 503 Service Unavailable or timeout
   ```

2. **Check ECS task status:**
   ```bash
   aws ecs describe-services --cluster prod-deploy-hub-cluster \
     --services prod-deploy-hub-service \
     --query 'services[0].{Status,DesiredCount,RunningCount,PendingCount}'
   # Expected: Status=ACTIVE, RunningCount=DesiredCount
   # Actual: RunningCount < DesiredCount or Status!=ACTIVE
   ```

3. **Check RDS database status:**
   ```bash
   aws rds describe-db-instances --db-instance-identifier prod-deploy-hub-db \
     --query 'DBInstances[0].DBInstanceStatus'
   # Expected: available
   # Actual: backing-up, rebooting, failing-over, etc.
   ```

4. **Check recent deployments (last 5 min):**
   - AWS CodePipeline console: any failed recent deploys of deploy-hub itself?
   - Check CodeBuild logs for crash or startup errors

**Mitigation Options (Choose ONE in this order):**

**Option A: Restart ECS Tasks (Fastest, ~2 min)**
```bash
# Force replace all ECS tasks (graceful drain + restart)
aws ecs update-service \
  --cluster prod-deploy-hub-cluster \
  --service prod-deploy-hub-service \
  --force-new-deployment

# Wait for tasks to become healthy
aws ecs wait services-stable \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service
# Wait ~3 min for new tasks to boot and pass health checks
```
- **Pros:** Fixes memory leaks, process hangs, transient state corruption
- **Cons:** Brief downtime (30–60 sec during traffic cutover); deployments in-flight will fail

**Option B: Rollback Recent Deployment (if recent change caused issue)**
- Check git log: any deploy-hub code changes in last 2 hours?
- If yes: trigger rollback via AWS CodePipeline or GitHub Actions
- See [Recovery: Force Rollback via CodeDeploy](#recovery-force-rollback-via-codedeploy)

**Option C: RDS Failover (if database is stuck or slow)**
- Check RDS Multi-AZ status: is secondary available?
- Trigger failover:
  ```bash
  aws rds reboot-db-instance \
    --db-instance-identifier prod-deploy-hub-db \
    --multi-az
  # Expect failover to secondary in ~30–60 seconds
  ```
- **Pros:** Fixes corrupted database connection or stuck locks
- **Cons:** 30–60 sec downtime; may lose recent uncommitted transactions

**Escalation:**
- Acknowledge alert; assign an owner
- If unresolved after 5 min mitigation attempt: **page secondary on-call immediately**
- Notify Platform Head if SEV-1 persists > 10 min
- Do NOT attempt complex debugging; focus on fast recovery

**Success Criteria:**
- `curl https://deploy-hub.prod.nasco.com/health` returns HTTP 200 OK
- ECS tasks running (RunningCount = DesiredCount)
- New deployment requests succeed (`POST /deployments` returns 202 Accepted)

---

### Incident: SEV-2 — Degraded State

**Detection:**
- Alert: `HighErrorRate` > 5% sustained > 5 min, OR `SLOBurnRateCritical` (6h window), OR
- Manual report: "Some deployments fail but service is up", OR
- Rollback feature unavailable, health checks timing out, etc.

**Triage Steps (First 15 Minutes):**

1. **Identify affected endpoint(s):**
   ```promql
   # Loki query: top error messages (last 15 min)
   {service="deploy_hub"} |= "error" | json | errors != "" | error_count
   
   # Prometheus: error rate by endpoint
   rate(http_requests_total{service="deploy_hub",status=~"5.."}[5m]) by (endpoint)
   ```

2. **Check recent changes:**
   - Deploy-hub recent commits: `git log --oneline -20 main`
   - Any recent Terraform changes to infra? `git log infra/ -20`
   - Any dependency updates? `package.json` changes

3. **Assess saturation:**
   ```bash
   # Dashboard: Golden Signals → Saturation panel
   # Check: CPU %, memory %, RDS connections, deployment queue depth
   ```

4. **Determine root cause category:**
   - **Upstream dependency:** CodeBuild/CodeDeploy failing, artifact registry slow?
   - **Database contention:** connections pooled, slow queries?
   - **Resource saturation:** CPU > 85%, memory > 90%?
   - **Code bug:** error message suggests logic error?
   - **Network/infrastructure:** security group rule change, DNS resolution failure?

**Mitigation Options (Choose based on root cause):**

**If Upstream Dependency (CodeBuild/CodeDeploy) Down:**
- Check AWS status page: [status.aws.amazon.com](https://status.aws.amazon.com)
- Wait for AWS to recover, or switch region if multi-region capable
- Mitigation: Scale down concurrent deployments (feature flag to reject submissions temporarily)

**If Database Slow or Pool Exhausted:**
- See [Recovery: Database Connection Pool Exhausted](#recovery-database-connection-pool-exhausted)
- Or scale RDS instance: `aws rds modify-db-instance --db-instance-identifier prod-deploy-hub-db --db-instance-class db.t3.medium --apply-immediately`
- Expect ~5 min failover + restart downtime

**If Resource Saturation (CPU/Memory):**
- Scale ECS tasks: `aws ecs update-service --cluster prod-deploy-hub-cluster --service prod-deploy-hub-service --desired-count 4` (or 5)
- Wait ~2 min for new tasks to boot
- Monitor: error rate should drop as load spreads

**If Code Bug (Error Message Suggests Logic Issue):**
- Check recent commits: revert recent change to main
- Trigger re-deployment: `aws codepipeline start-pipeline-execution --name prod-deploy-hub-pipeline`
- If revert fixes issue: add to postmortem, plan debugging session

**Escalation:**
- **If error rate > 10% sustained > 10 min:** escalate to SEV-2, page secondary on-call
- **If SLO burn rate critical:** freeze feature work, focus on stabilization
- **If root cause unclear:** engage on-call + service owner for joint debugging

**Success Criteria:**
- Error rate < 1% for 5 min consecutive
- No new errors appearing in logs
- All ECS tasks in RUNNING state
- RDS connections < 50 (or baseline)

---

### Incident: SEV-3 — SLO Burn Rate Elevated

**Detection:**
- Alert: `SLOBurnRateHigh` (1h window, 14x nominal), OR
- Dashboard: p99 latency approaching SLO threshold (e.g., p99 at 40 min for 45-min SLO), OR
- Manual observation: deployments slower than usual but still completing

**Triage Steps (First 1 Hour):**

1. **Confirm SLO metric trend:**
   ```promql
   # 1-hour burn rate
   (
     rate(http_requests_total{service="deploy_hub",status=~"5.."}[1h])
     / rate(http_requests_total{service="deploy_hub"}[1h])
   ) * 100
   
   # SLO target for reference: < 0.5% error rate
   ```

2. **Identify performance bottleneck:**
   - Check latency histogram: which stage is slow? (prepare, validate, deploy, verify)
   - Check deployment logs: any repeated failure pattern?
   - Check saturation: is CPU/memory/connections trending high?

3. **Gather context:**
   - Business impact: how many deployments affected? (e.g., 10% slower)
   - Team impact: any services waiting for deploy-hub capacity?
   - Root cause: infrastructure limit, upstream service latency, code inefficiency?

**Mitigation Options:**

**If Latency Degraded but No Errors (p99 slow):**
- Monitor and document
- No immediate action needed if within SLO bounds
- Create ticket for optimization (e.g., reduce pre-deployment validation time)

**If Error Rate Trending Up (toward 1%):**
- Check resource saturation: scale if CPU > 80%
- Check logs: are specific deployments failing repeatedly?
- If recent code change: revert to previous version
- If infrastructure issue: check AWS status, wait for recovery

**If Deployment Queue Depth Growing:**
- May indicate sustained demand > capacity
- Scale ECS tasks temporarily
- Consider load-shedding: reject excess deployments with 429 (Too Many Requests) until queue drains

**Escalation:**
- Document in ticket; do not page on-call
- Notify team lead for awareness
- If trend continues > 2 hours: escalate to SEV-2, page on-call

**Success Criteria:**
- Error rate returns to < 0.5%
- p99 latency returns to < 35 min (comfortable margin from 45-min SLO)
- Queue depth drains to < 3 deployments

---

### Incident: SEV-4 — Informational

**Detection:**
- Single deployment fails (not systemic error), OR
- One user reports issue with single deployment, OR
- Deployment takes 44 min (within SLO but slow), OR
- Flaky health check that recovers automatically

**Triage Steps:**

1. **Investigate specific deployment:**
   ```bash
   DEPLOYMENT_ID="d4c91d08-6b8f-4e2a-9c1b-2f8e7d9c1a4b"  # from report
   
   # Query deployment state
   curl -H "Authorization: Bearer $TOKEN" \
     https://deploy-hub.prod.nasco.com/deployments/$DEPLOYMENT_ID
   
   # View deployment logs
   curl -H "Authorization: Bearer $TOKEN" \
     https://deploy-hub.prod.nasco.com/deployments/$DEPLOYMENT_ID/logs
   ```

2. **Determine if user error or system bug:**
   - Invalid artifact_url? → 400 Bad Request (user error, guide customer)
   - Health check endpoint wrong? → Rollback triggered (advise customer to fix endpoint)
   - Resource limit hit? → Deployment queued but succeeded later (expected behavior)

**Mitigation Options:**
- Document in ticket (not incident channel)
- Add to next team retrospective if pattern emerges
- No paging or escalation needed

---

## Recovery Procedures

### Recovery: Restart ECS Service

```bash
# Step 1: Force replace ECS tasks (new deployments start, old ones drain)
aws ecs update-service \
  --cluster prod-deploy-hub-cluster \
  --service prod-deploy-hub-service \
  --force-new-deployment

# Step 2: Wait for tasks to become healthy
# Polls every 6 seconds; waits up to 180 seconds (3 min)
aws ecs wait services-stable \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service

# Step 3: Verify all tasks healthy
aws ecs describe-services \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# Step 4: Verify API responding
curl -I https://deploy-hub.prod.nasco.com/health
# Expected: HTTP 200 OK

echo "✅ ECS service restart complete"
```

**Duration:** ~2–3 min (new task startup + ALB health check pass)

**Implications:**
- Brief service disruption (30–60 sec) during traffic cutover
- In-flight deployments will fail; operators must retry
- Recommended during maintenance window, not during business hours unless emergency

---

### Recovery: Force Rollback via CodeDeploy

```bash
# Step 1: Identify previous deployment version
PREVIOUS_VERSION=$(git rev-parse HEAD~1)  # or from deployment audit log

# Step 2: Trigger new CodePipeline execution with rollback artifact
aws codepipeline start-pipeline-execution \
  --name prod-deploy-hub-pipeline \
  --client-request-token "rollback-$(date +%s)" \
  --pipeline-variables "ARTIFACT_VERSION=$PREVIOUS_VERSION,ROLLBACK_FLAG=true"

# Step 3: Monitor rollback progress
# (Watch AWS CodePipeline console or GitHub Actions logs)

# Step 4: Verify rollback complete
curl https://deploy-hub.prod.nasco.com/health
git rev-parse $(aws ecs describe-services \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service \
  --query 'services[0].deployments[0].taskDefinition' | grep -oE '[a-f0-9]{40}')

echo "✅ Rollback to $PREVIOUS_VERSION complete"
```

**Duration:** ~5–10 min (CodeBuild → CodeDeploy → health checks)

**When to use:**
- Recent deploy introduced bug (errors spike immediately after deploy)
- Data migration issue (rollback to safe schema)
- Dependent service down (temporary, rollback to stable)

**When NOT to use:**
- Database corruption (rollback doesn't fix database; requires manual recovery)
- Lost data (rollback doesn't restore deleted data)

---

### Recovery: Database Connection Pool Exhausted

```bash
# Step 1: Check current connections
aws rds describe-db-instances \
  --db-instance-identifier prod-deploy-hub-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Step 2: Query active connections from deploy-hub pod
POD_ID=$(aws ecs describe-tasks \
  --cluster prod-deploy-hub-cluster \
  --tasks $(aws ecs list-tasks --cluster prod-deploy-hub-cluster --query 'taskArns[0]' | grep -oE 'task/[^"]*') \
  --query 'tasks[0].taskArn')

# Step 3: Kill idle connections from deploy-hub app
# Option A: Restart ECS tasks (closes all connections)
aws ecs update-service \
  --cluster prod-deploy-hub-cluster \
  --service prod-deploy-hub-service \
  --force-new-deployment

# Option B: Scale RDS instance for more connection slots
aws rds modify-db-instance \
  --db-instance-identifier prod-deploy-hub-db \
  --db-instance-class db.t3.medium \
  --apply-immediately
# Expect ~5 min failover downtime

# Step 4: Verify pool recovered
aws rds describe-db-clusters \
  --db-cluster-identifier prod-deploy-hub-db \
  --query 'DBClusters[0].DBClusterMembers[0].PromotionTier'
# and check Grafana: active connections < 50

echo "✅ Connection pool recovery complete"
```

**Duration:**
- Option A (restart): ~2–3 min
- Option B (scale): ~5–10 min downtime + failover

---

### Recovery: Scaling Out ECS Tasks

```bash
# Step 1: Check current task count
aws ecs describe-services \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service \
  --query 'services[0].{DesiredCount:desiredCount,RunningCount:runningCount}'

# Step 2: Scale to higher count (e.g., 3 tasks)
aws ecs update-service \
  --cluster prod-deploy-hub-cluster \
  --service prod-deploy-hub-service \
  --desired-count 4

# Step 3: Wait for tasks to become healthy
aws ecs wait services-stable \
  --cluster prod-deploy-hub-cluster \
  --services prod-deploy-hub-service

# Step 4: Verify ECS targets registered with ALB
ALB_TG_ARN=$(aws elbv2 describe-target-groups \
  --names prod-deploy-hub-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

aws elbv2 describe-target-health \
  --target-group-arn $ALB_TG_ARN \
  --query 'TargetHealthDescriptions[].{Id:Target.Id,State:TargetHealth.State}'
# Expected: All targets show State=healthy

# Step 5: Monitor error rate decline
# Dashboard → Golden Signals → Errors panel; should trend down within 1 min

echo "✅ Scale-out complete; error rate should normalize"
```

**Duration:** ~2–3 min (new task startup + ALB health check pass)

**When to scale out:**
- CPU > 80% for sustained period
- Error rate elevated due to resource contention
- Deployment queue depth growing

**When to scale down:**
- CPU < 30% for 30+ min (cost optimization)
- Manual only; no auto-scaling down (gradual drain better than aggressive kill)

---

### Recovery: Artifact Cache Cleared (Manual)

```bash
# If health checks timing out due to slow artifact pulls:
# (Or if artifact corrupted in ECS image cache)

# Step 1: Clear ECS task image cache
aws ecs update-service \
  --cluster prod-deploy-hub-cluster \
  --service prod-deploy-hub-service \
  --force-new-deployment
# New tasks will pull fresh container image from ECR

# Step 2: Alternatively, clear ECR image cache (if using ECR)
aws ecr batch-delete-image \
  --repository-name deploy-hub \
  --image-ids imageTag=latest
# (Don't delete immutable SHAs; only mutable tags)

# Step 3: Redeploy via CodePipeline
aws codepipeline start-pipeline-execution --name prod-deploy-hub-pipeline

echo "✅ Artifact cache cleared; redeploy initiated"
```

---

## Contacts and Escalation

### Primary On-Call

| Contact | Role | Channel | SLA |
|---|---|---|---|
| **Platform On-Call** | First responder for all deploy-hub incidents | PagerDuty + `#deploy-hub-incidents` | SEV-1: 5 min ACK, SEV-2: 15 min ACK |
| **Secondary On-Call** | Backup if primary unavailable | PagerDuty (page after 10 min no-ack) | SEV-1 only |
| **Platform Head** | Escalation for SEV-0/SEV-1 | Direct page if SEV-1 persists > 10 min | ASAP |
| **Infrastructure Team** | For AWS service issues | Slack: `#infrastructure` | 30 min response (business hours) |

### External Dependencies

| Service | Contact | Status Page |
|---|---|---|
| **AWS CodeBuild/CodeDeploy** | AWS Support (Enterprise account) | [status.aws.amazon.com](https://status.aws.amazon.com) |
| **AWS RDS** | AWS Support | [status.aws.amazon.com](https://status.aws.amazon.com) |
| **Artifact Registry (ECR)** | Infrastructure Team | [status.aws.amazon.com](https://status.aws.amazon.com) |
| **Prometheus/Grafana** | Observability Team | Check #observability Slack |
| **Target Services (health checks)** | Service-specific teams | Refer to team Slack channel |

### Postmortem Process

All SEV-1 and SEV-2 incidents require a blameless postmortem within 10 business days.

**Postmortem template:** `docs/ops/POSTMORTEM-YYYYMMDD.md`

**Key sections:**
1. Impact: How many deployments blocked? Duration?
2. Root cause: 5-whys or fishbone analysis
3. Contributing factors: What in the system made this incident possible?
4. What went well: Acknowledge effective response actions
5. Action items: Assign owners and due dates

**File location:** [docs/ops/POSTMORTEM-YYYYMMDD.md](POSTMORTEM-TEMPLATE.md) (copy template, rename with date)

---

## Reference

- **Full Architecture:** [docs/architecture/DESIGN.md](../architecture/DESIGN.md)
- **API Contracts:** [docs/architecture/API-CONTRACTS.yaml](../architecture/API-CONTRACTS.yaml)
- **Product Specification:** [docs/spec/SPEC.md](../spec/SPEC.md)
- **Release Runbook:** [docs/ops/RELEASE-RUNBOOK.md](../ops/RELEASE-RUNBOOK.md) (deployment procedures)
- **Security Review:** [docs/security/SECURITY-REVIEW.md](../security/SECURITY-REVIEW.md)
- **QA Report:** [docs/qa/QA-REPORT.md](../qa/QA-REPORT.md)
- **ADRs:** [docs/adr/](../adr/) (architecture decision records)

---

## Appendix: Common Debugging Commands

### Check All Metrics

```bash
# SSH into ECS task
TASK_ID=$(aws ecs list-tasks --cluster prod-deploy-hub-cluster --query 'taskArns[0]' | grep -oE 'task/[^"]*')

aws ecs execute-command \
  --cluster prod-deploy-hub-cluster \
  --task $TASK_ID \
  --container deploy-hub-api \
  --interactive \
  --command "/bin/bash"

# Inside container:
# Check metrics endpoint
curl http://localhost:3000/metrics | grep deploy_hub_

# Check logs
tail -f /var/log/deploy-hub/*.log

# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"
```

### Query Recent Deployments

```bash
# From any machine with AWS credentials
aws rds describe-db-instances --db-instance-identifier prod-deploy-hub-db \
  --query 'DBInstances[0].Endpoint.Address'
# Copy the address

psql -h <address> -U deploy_hub_user -d deploy_hub_prod \
  -c "SELECT id, status, created_at, updated_at FROM deployments ORDER BY created_at DESC LIMIT 10;"

# Or via deploy-hub API
curl -H "Authorization: Bearer $TOKEN" \
  https://deploy-hub.prod.nasco.com/deployments?limit=10
```

### Tail Real-Time Logs

```bash
# Loki query in Grafana
# (Or via CLI)
# logcli query '{service="deploy_hub"} |= "ERROR" | json' --limit=100 --tail

# CloudWatch Logs
aws logs tail /aws/ecs/prod-deploy-hub-cluster --follow

# ECS task stdout/stderr
aws ecs describe-tasks --cluster prod-deploy-hub-cluster --tasks <task-arn> \
  --query 'tasks[0].containers[0]' | jq '.lastStatus,.reason'
```

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Next Review:** 2026-08-21 (quarterly)
