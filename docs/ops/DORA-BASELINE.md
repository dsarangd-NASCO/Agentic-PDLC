# DORA Metrics Baseline — deploy-hub

**Established:** 2026-05-21  
**Service:** deploy-hub (deployment orchestration platform)  
**Measurement Window:** First 30 days in production (2026-05-21 to 2026-06-20)  
**Review Cadence:** Monthly (every 30 days)  
**Target Tier:** DORA Elite (Accelerate book, Forsgren et al. 2018)  

---

## Executive Summary

deploy-hub is a new service launching to production. This baseline document establishes initial targets for the four DORA metrics based on the platform's design and SLOs. The service aims to reach "Elite" tier performance within 2 sprints (by end of Q2 2026) and maintain or exceed it thereafter.

**DORA Elite Targets (goal for all services per NASCO engineering policy):**
| Metric | Elite Target |
|---|---|
| **Deployment Frequency** | On demand (multiple/day) |
| **Change Lead Time** | < 1 day (ideally < 4 hours) |
| **Change Failure Rate** | ≤ 5% |
| **Mean Time to Recovery** | < 1 hour |

**deploy-hub Sprint 1 Targets (ramp-up, achievable in first 30 days):**
| Metric | Sprint 1 Target | Elite Target | Rationale |
|---|---|---|---|
| **Deployment Frequency** | ≥ 1/day | On demand | First month: stabilization phase; no feature changes until SLO established |
| **Change Lead Time** | < 4 hours | < 1 day | Fast feedback loop for critical service |
| **Change Failure Rate** | ≤ 10% | ≤ 5% | Ramp-up allowance; target ≤ 5% by Sprint 2 |
| **Mean Time to Recovery** | < 2 hours | < 1 hour | Service new; operators need context on failure modes |

---

## 1. Deployment Frequency

**Definition:** How often code is deployed to production. Measured in "deployments per day" or "deployments per week". Higher frequency indicates faster feedback and smaller blast radius per change.

### Measurement

| Metric | Value |
|---|---|
| **SLI** | Count of successful `aws codepipeline get-pipeline-execution` records with status="Succeeded" in target window |
| **Granularity** | Daily (deployments per day) |
| **Calculation** | Sum of pipeline executions reaching "Deploy" stage successfully during calendar day (UTC) |
| **Data Source** | AWS CodePipeline API + CloudWatch Events rule → CloudWatch Metrics |
| **Collection Method** | Automated: Lambda function triggered on CodePipeline state change → CloudWatch Metric `deploy_hub_deployments_per_day` |
| **Frequency** | Real-time (metric updated on each deploy) |

### Initial Target (Sprint 1)

**Target:** ≥ 1 deployment per day (i.e., at least one production deploy per calendar day on average)

**Rationale:** 
- deploy-hub is a new service; first 30 days focus on stabilization, not feature velocity
- Service runs in production with SLO monitoring; changes must be careful (small, tested, reversible)
- Target allows for: daily bug fixes + weekly feature work
- Once SLO baseline established: ramp to "on demand" (multiple/day)

**Success Definition:**
- At least 21 of 30 calendar days have ≥ 1 deployment (70% deployment frequency)
- No more than 2 consecutive days without deployment (indicates code freeze or blocker)

### Elite Target (End of Sprint 2)

**Target:** On demand (2–5 deployments per day typical)

**Path to Elite:**
- Sprint 1: Establish SLO, catch bugs, stabilize infrastructure
- Sprint 2: Reduce per-deploy change batch size, implement feature flags for incomplete work
- Week 1 of Sprint 2: Pilot multi-deploy-per-day workflow (e.g., bug fix + minor feature)
- Week 2 of Sprint 2: Sustain 2–5 deploys/day if SLO maintained

### Prometheus Query

```promql
# Current deployment frequency (deployments in last 24h)
rate(deploy_hub_codepipeline_executions_total{status="Succeeded"}[24h])

# Trend: 7-day rolling average
avg_over_time(rate(deploy_hub_codepipeline_executions_total{status="Succeeded"}[1d])[7d:1d])

# Alert if < 1 per day for 3 consecutive days
(
  rate(deploy_hub_codepipeline_executions_total{status="Succeeded"}[24h]) < (1 / 86400)
) and (
  count_over_time(
    rate(deploy_hub_codepipeline_executions_total{status="Succeeded"}[24h]) < (1 / 86400)
    [72h:1h]
  ) >= 72
)
```

### Grafana Dashboard Panel

**Panel: `Deployment Frequency (deploys/day)`**
```json
{
  "title": "Deployment Frequency",
  "description": "Successful CodePipeline deployments per day. DORA Elite target: 'on demand' (2-5/day)",
  "targets": [
    {
      "expr": "rate(deploy_hub_codepipeline_executions_total{status=\"Succeeded\"}[24h]) * 86400",
      "legendFormat": "Deploys/day (24h rolling)",
      "refId": "A"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "thresholds": {
        "mode": "absolute",
        "steps": [
          {"color": "red", "value": 0},
          {"color": "yellow", "value": 1},
          {"color": "green", "value": 2}
        ]
      }
    }
  },
  "targets_annotation_link": "DORA #1: Deployment Frequency"
}
```

---

## 2. Change Lead Time

**Definition:** Time from code commit to production deployment. Measures how quickly feedback reaches operators. Lower values enable faster iteration and problem detection.

### Measurement

| Metric | Value |
|---|---|
| **SLI** | Duration from first commit in GitHub to successful deploy on production (timestamp when CodeDeploy reaches "Succeeded" state) |
| **Granularity** | Per-deployment (record lead time for each deploy) |
| **Calculation** | `codepipeline_completion_timestamp` - `git_first_commit_timestamp` |
| **Data Source** | GitHub API (commit timestamp) + AWS CodePipeline API (deploy timestamp) → joined in metric ingestion |
| **Collection Method** | Lambda function in CodePipeline "Deploy" stage success handler: fetch commit from GitHub, calculate delta, emit metric `deploy_hub_lead_time_seconds` |
| **Frequency** | Per deployment (histogram recorded) |

### Initial Target (Sprint 1)

**Target:** < 4 hours (14,400 seconds) median lead time

**Breakdown:**
- Git commit → CodeBuild start: ~30 sec (source fetch)
- CodeBuild (lint, test, build, push image): ~8–12 min
- CodeBuild → CodeDeploy start: ~30 sec (artifact staging)
- CodeDeploy (rolling deployment, health checks): ~5–10 min
- **Total typical:** 14–24 min (well within 4-hour target)
- **Total p95:** ~30–40 min (worst case)
- **Total p99:** ~60 min (infrastructure delays, large image push)

**Success Definition:**
- Median lead time: 20 min
- p95 lead time: < 45 min
- p99 lead time: < 90 min
- No changes taking > 4 hours to deploy

### Elite Target (End of Sprint 2)

**Target:** < 1 day (< 86,400 seconds) — ideally < 4 hours maintained

**Path to Elite:**
- Sprint 1: Establish baseline (should already be < 4h for most commits)
- Sprint 2: Profile slow stages, optimize image build/push pipeline
- Optimize: parallel test stages, cache dependencies in Docker image, pre-warm artifact cache

### Prometheus Query

```promql
# P50 (median) lead time
histogram_quantile(0.50, rate(deploy_hub_lead_time_seconds_bucket[30d]))

# P95 lead time
histogram_quantile(0.95, rate(deploy_hub_lead_time_seconds_bucket[30d]))

# P99 lead time
histogram_quantile(0.99, rate(deploy_hub_lead_time_seconds_bucket[30d]))

# Lead time trend (weekly)
avg_over_time(histogram_quantile(0.50, rate(deploy_hub_lead_time_seconds_bucket[1d]))[7d:1d])
```

### Grafana Dashboard Panel

**Panel: `Change Lead Time (minutes)`**
```json
{
  "title": "Change Lead Time",
  "description": "Time from commit to production deploy. DORA Elite: < 1 day (ideally < 4h)",
  "targets": [
    {
      "expr": "histogram_quantile(0.50, rate(deploy_hub_lead_time_seconds_bucket[30d])) / 60",
      "legendFormat": "Median (30-day)",
      "refId": "A"
    },
    {
      "expr": "histogram_quantile(0.95, rate(deploy_hub_lead_time_seconds_bucket[30d])) / 60",
      "legendFormat": "p95 (30-day)",
      "refId": "B"
    },
    {
      "expr": "histogram_quantile(0.99, rate(deploy_hub_lead_time_seconds_bucket[30d])) / 60",
      "legendFormat": "p99 (30-day)",
      "refId": "C"
    }
  ],
  "thresholds": [
    {"color": "red", "value": 240, "label": "Alert if > 4h"},
    {"color": "yellow", "value": 60, "label": "4h target"},
    {"color": "green", "value": 0}
  ]
}
```

---

## 3. Change Failure Rate

**Definition:** Percentage of deployments that cause an incident or rollback within 24 hours post-deploy. Indicates code quality and testing effectiveness.

### Measurement

| Metric | Value |
|---|---|
| **SLI** | Count of deployments followed by rollback or incident within 24h post-deploy / total deployments |
| **Granularity** | Per-deployment (rolling 30-day window) |
| **Calculation** | `(deployments_with_rollback + deployments_with_incident) / total_deployments` × 100% |
| **Failure Definition** | Deployment marked as "Failed" OR deployment rolled back (auto or manual) within 24h of completion OR P1/P2 incident created referencing deployment |
| **Data Source** | deploy-hub database (deployment state + rollback records) + incident tracking system |
| **Collection Method** | Query: For each deployment in window, check: (1) status="failed", (2) rollback within 24h, (3) incident linked within 24h |
| **Frequency** | Daily calculation; metric refreshed at end of day (UTC) |

### Initial Target (Sprint 1)

**Target:** ≤ 10% change failure rate

**Rationale:**
- deploy-hub is new; some issues expected as service stabilizes
- 10% allowance = ~3 failed/rolled-back deployments per month (30 deployments assumed)
- Must improve to ≤ 5% by Sprint 2 (goal is elite tier)
- Threshold indicates when feature work should pause for reliability focus

**Success Definition:**
- At most 3 deployments (out of 30) fail or rollback per month
- No consecutive rollbacks (indicates systemic issue, not random glitch)
- Root cause documentation required for each failure

### Elite Target (End of Sprint 2)

**Target:** ≤ 5% change failure rate

**Path to Elite:**
- Sprint 1: Stabilize infrastructure, catch obvious bugs via QA
- Sprint 2: Improve test coverage to ≥ 80%, implement contract tests with dependencies
- Implement SLO alerts to catch regressions before customers report
- Require sign-off from QA before main branch merge

### Prometheus Query

```promql
# Change failure rate (rolling 30 days)
(
  count(deploy_hub_deployments_failed_total) + count(deploy_hub_deployments_rolled_back_total)
) / count(deploy_hub_deployments_total) * 100

# Trend
avg_over_time(
  (
    increase(deploy_hub_deployments_failed_total[1d]) + 
    increase(deploy_hub_deployments_rolled_back_total[1d])
  ) / increase(deploy_hub_deployments_total[1d])[30d:1d]
) * 100
```

### Grafana Dashboard Panel

**Panel: `Change Failure Rate (%)`**
```json
{
  "title": "Change Failure Rate",
  "description": "% of deployments causing rollback/incident within 24h. DORA Elite: ≤ 5%",
  "targets": [
    {
      "expr": "(increase(deploy_hub_deployments_failed_total[30d]) + increase(deploy_hub_deployments_rolled_back_total[30d])) / increase(deploy_hub_deployments_total[30d]) * 100",
      "legendFormat": "CFR (30-day rolling)",
      "refId": "A"
    }
  ],
  "thresholds": [
    {"color": "green", "value": 0},
    {"color": "yellow", "value": 5, "label": "Elite target"},
    {"color": "red", "value": 10, "label": "Alert if > 10%"}
  ]
}
```

---

## 4. Mean Time to Recovery (MTTR)

**Definition:** Average time to restore service after an incident or failure. Measures operational response effectiveness.

### Measurement

| Metric | Value |
|---|---|
| **SLI** | Duration from incident open → incident resolved (closed in incident tracking system) for all deploy-hub related incidents |
| **Granularity** | Per-incident (rolling 30-day window, average) |
| **Calculation** | Sum of (incident_closed_timestamp - incident_open_timestamp) / count of incidents |
| **Incident Definition** | SEV-1, SEV-2, SEV-3 incidents affecting deploy-hub availability, latency, or correctness |
| **Data Source** | Incident tracking system (PagerDuty or custom incident log) |
| **Collection Method** | Query incident tracking API: filter by service="deploy-hub", sum durations, divide by count |
| **Frequency** | Daily calculation; metric updated when incidents closed |

### Initial Target (Sprint 1)

**Target:** < 2 hours mean recovery time

**Rationale:**
- Assumes 1–2 incidents per month in first 30 days (as new service stabilizes)
- If incident resolution averages 90 min, MTTR = 90 min (< 2 hours) ✓
- 2-hour target allows for: on-call ack time (5–15 min) + triage (10–20 min) + mitigation (30–90 min)
- Once SLO established: ramp to < 1 hour (elite)

**Success Definition:**
- Average incident resolution time: ≤ 120 minutes
- p95 MTTR: ≤ 180 minutes (worst-case incidents take < 3 hours)
- On-call acknowledgment SLA met (SEV-1: ≤ 5 min, SEV-2: ≤ 15 min)

### Elite Target (End of Sprint 2)

**Target:** < 1 hour mean recovery time

**Path to Elite:**
- Sprint 1: Document incident runbooks, establish on-call rotation
- Sprint 2: Practice incident response (game days), pre-stage recovery procedures, automate common remediations
- Implement fast-track mitigations: auto-restart ECS service for hung process, auto-scale for saturation

### Prometheus Query

```promql
# MTTR metric (avg incident resolution time, last 30 days)
# (Requires integration with incident tracking system — manual query or webhook ingest)

# Backup: Calculate from deployment state machine
# (Rollback as a proxy for "incident recovery")
histogram_quantile(0.50, rate(deploy_hub_incident_duration_seconds_bucket[30d])) / 60

# Mean MTTR (average)
avg(rate(deploy_hub_incident_duration_seconds[30d])) / 60
```

### Grafana Dashboard Panel

**Panel: `Mean Time to Recovery (minutes)`**
```json
{
  "title": "Mean Time to Recovery (MTTR)",
  "description": "Avg time to resolve incidents. DORA Elite: < 1 hour",
  "targets": [
    {
      "expr": "avg(rate(deploy_hub_incident_duration_seconds[30d])) / 60",
      "legendFormat": "Mean MTTR (30-day)",
      "refId": "A"
    },
    {
      "expr": "histogram_quantile(0.95, rate(deploy_hub_incident_duration_seconds_bucket[30d])) / 60",
      "legendFormat": "p95 MTTR (30-day)",
      "refId": "B"
    }
  ],
  "thresholds": [
    {"color": "green", "value": 0},
    {"color": "yellow", "value": 60, "label": "Elite target (1h)"},
    {"color": "red", "value": 120, "label": "Alert if > 2h"}
  ]
}
```

---

## Baseline Collection Plan

### Day 1 (2026-05-21) — Deploy to Production

**Actions:**
1. Deploy deploy-hub to prod; confirm SLO monitoring active
2. Instrument CodePipeline: AWS Lambda webhook captures each execution (commit → completion)
3. Instrument incident tracking: Jira/PagerDuty API integration to track failures
4. Create Grafana dashboard: `deploy-hub-dora-metrics` with 4 panels (see above)
5. Verify metrics flowing to Prometheus (may take 1–2 min for first data point)

**Validation:**
```bash
# Check metrics are flowing
curl http://prometheus:9090/api/v1/query?query=deploy_hub_codepipeline_executions_total | jq '.data.result'
# Should show at least one metric; if empty, debug Lambda integration

# Check Grafana dashboard
curl http://grafana:3000/api/dashboards/uid/deploy-hub-dora-metrics | jq '.dashboard.panels | length'
# Should show 4 panels
```

### Week 1 (2026-05-21 to 2026-05-27) — Manual Collection

**Daily task (5 min):**
- Query deploy count: `git log --oneline --since="24 hours ago" --grep="^feat\|^fix" main | wc -l`
- Query CFR: manual check — any rollbacks this week? (should be 0 in stable phase)
- Query MTTR: any incidents this week? (record start/end time)
- Populate spreadsheet: [DORA-BASELINE-WEEK-1.csv](DORA-BASELINE-WEEK-1.csv)

**Weekly summary (Friday EOD):**
- Deployment frequency: total deploys / 7 days
- Change lead time: spot-check 3 recent deployments; record times from commit → deploy
- CFR: count of failures / total deployments
- MTTR: if incidents, calculate avg duration

### Week 2–4 (2026-05-28 to 2026-06-20) — Automated Collection

**Prerequisites (Week 1 end):**
- Lambda function deployed and testing PASSED
- Prometheus metrics ingesting (verify in dashboard)
- Grafana dashboard displaying 4-week rolling data

**Weekly validation (Monday morning):**
- Spot-check: query Prometheus, compare to manual tracking from week 1
- If discrepancies > 10%, investigate data collection code
- If Prometheus missing data: check CloudWatch Logs for Lambda errors

**Daily alerts (ongoing):**
- If CFR approaching 10%: Slack notification to `#deploy-hub-team`
- If lead time trending > 2 hours: investigate bottleneck
- If MTTR incidents occurring: auto-link to postmortem template

---

## Sprint 1 vs Elite — Ramp-Up Plan

### Week 1–2 (Stabilization Phase)

| Activity | Owner | DORA Impact |
|---|---|---|
| Deploy to prod, confirm uptime > 99% | SRE | Deployment Frequency: establish baseline (≥ 1/day) |
| Fix bugs identified in first week | Dev | Change Failure Rate: maintain ≤ 10% |
| Runbook + on-call rotation trained | SRE | MTTR: establish < 2h baseline |
| Prometheus + Grafana metrics verified | SRE | All: start automated collection |

**Target state:** Stable service, ≤ 1 incident, median lead time 20–30 min

### Week 3–4 (Testing & Automation)

| Activity | Owner | DORA Impact |
|---|---|---|
| Add contract tests for CodeBuild/CodeDeploy | QA | Change Failure Rate: improve toward ≤ 7% |
| Parallelize CodeBuild stages | Platform Eng | Change Lead Time: target median < 20 min |
| Document fast-path mitigations | SRE | MTTR: prepare auto-restart playbook |
| Run incident game day (tabletop exercise) | SRE | MTTR: estimate < 1.5 hours recovery |

**Target state:** ≤ 5% CFR, < 20 min median lead time, fast mitigations ready

### Sprint 2 (Optimization Phase)

| Milestone | Week | DORA Target | How |
|---|---|---|---|
| **On Demand Deployments** | 1 | 2 deploys/day | Implement feature flags; land small features daily |
| **Elite Lead Time** | 2 | < 4h median (maintain < 30 min) | Optimize image build/push; parallel tests |
| **Elite CFR** | 3 | ≤ 5% | Improve test coverage to ≥ 80% |
| **Elite MTTR** | 4 | < 1 hour | Automate 80% of mitigations; practice game days |

**Graduation criteria (end of Sprint 2):** All 4 DORA metrics at Elite tier for 2 consecutive weeks

---

## Monitoring & Alerting

### DORA Metrics Grafana Dashboard

**URL:** [grafana.nasco.com/d/deploy-hub-dora-metrics](https://grafana.nasco.com/d/deploy-hub-dora-metrics)

**Panels:**
1. Deployment Frequency (deploys/day) — stacked bar chart, daily granularity
2. Change Lead Time (minutes) — line chart, p50/p95/p99
3. Change Failure Rate (%) — gauge + line trend
4. MTTR (minutes) — gauge + line trend

**Refresh:** 1 min (real-time as data arrives)

### Automated Alerts

| Alert | Trigger | Severity | Action |
|---|---|---|---|
| `DeploymentFrequencyLow` | < 1/day for 3 consecutive days | SEV-3 | Slack notification to `#deploy-hub-team`: "No deploys in 3 days — check for blocker" |
| `ChangeFailureRateLow` | CFR > 10% | SEV-2 | PagerDuty page: "CFR exceeded threshold; assess recent deployments for rollback opportunity" |
| `LeadTimeTrending` | p50 > 40 min | SEV-3 | Slack: "Lead time trending > 40 min — profile build/deploy stages" |
| `MTTRHigh` | MTTR > 2 hours (Sprint 1) | SEV-2 | PagerDuty page: "Recent incident MTTR exceeded; plan postmortem" |

---

## Monthly Review Cadence

**Every 30 days (first review: 2026-06-20):**

1. **Calculate 30-day rolling metrics:**
   - Deployment Frequency: count deploys, divide by 30
   - Change Lead Time: median/p95/p99 of 30-day deployment lead times
   - CFR: (failed + rolled_back) / total × 100%
   - MTTR: mean incident resolution time (if ≥ 1 incident)

2. **Compare vs target:**
   - Sprint 1 target: How close to target? (±10% acceptable)
   - Trend: Is metric improving or degrading week-over-week?
   - Blocker: Did any metric breach SLO? (If CFR > 10%: freeze features; if MTTR > 2h: retrain on-call)

3. **Update this document:**
   - Record actual baseline in "Actual Results" section (see below)
   - Adjust Sprint 2 targets if needed based on production learnings
   - Flag risks (e.g., "Lead time creeping up — image size growing")

4. **Publish summary:**
   - Slack: `#deploy-hub-team` — "Monthly DORA Review: DF=1.2/day, CFR=8%, MTTR=105 min, Lead Time p50=22 min"
   - Team standup: discuss top 3 opportunities to reach elite tier

---

## Actual Results (to be populated monthly)

### Month 1: 2026-05-21 to 2026-06-20

| Metric | Target | Actual | Status | Notes |
|---|---|---|---|---|
| **Deployment Frequency** | ≥ 1/day | TBD | 🟡 | Update after week 4 |
| **Change Lead Time (p50)** | < 4 hours | TBD | 🟡 | | Expected ~20 min; update after week 4 |
| **Change Lead Time (p95)** | < 4 hours | TBD | 🟡 | |
| **Change Failure Rate** | ≤ 10% | TBD | 🟡 | |
| **MTTR (avg)** | < 2 hours | TBD | 🟡 | |

**Incidents this month:**
- (None expected Sprint 1)

**Blockers/Risks:**
- (None currently)

### Month 2: 2026-06-20 to 2026-07-20

(To be populated after Month 1 review)

### Month 3: 2026-07-20 to 2026-08-20

(To be populated after Month 2 review)

---

## Glossary

| Term | Definition |
|---|---|
| **Deployment Frequency** | How often code is successfully deployed to production (ideal: on-demand, multiple times/day) |
| **Change Lead Time** | Duration from code commit to production deployment (ideal: < 1 day) |
| **Change Failure Rate** | Percentage of deployments causing a failure/incident/rollback within 24 hours (ideal: ≤ 5%) |
| **Mean Time to Recovery** | Average duration to fix and re-deploy after an incident (ideal: < 1 hour) |
| **DORA Elite** | Highest tier of software delivery performance per "Accelerate: The Science of Lean Software and DevOps" (Forsgren, Humble, Kim 2018) |
| **SLO** | Service Level Objective — the target reliability metric (e.g., 99.5% availability) |
| **SLI** | Service Level Indicator — the measurement that tracks SLO (e.g., successful API requests / total requests) |
| **Rollback** | Deployment of a previous stable version, typically in response to a bug or failure |
| **Incident** | Unplanned interruption or degradation of service; tracked in incident management system |

---

## Reference

- **SLOs & Alerts:** [docs/ops/RUNBOOK.md](./RUNBOOK.md#slo-definitions)
- **Deployment Procedures:** [docs/ops/RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md)
- **Architecture:** [docs/architecture/DESIGN.md](../architecture/DESIGN.md)
- **DORA Framework:** Forsgren, Humble, Kim (2018) "Accelerate: The Science of Lean Software and DevOps" (O'Reilly)
- **Prometheus Metrics:** [docs/ops/INSTRUMENTATION.md](./INSTRUMENTATION.md) (to be created Phase 2)

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Next Review:** 2026-06-20 (Month 1 review)
