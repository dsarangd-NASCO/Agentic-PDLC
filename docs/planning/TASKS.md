# Deploy-Hub — Task Backlog

## Backlog Composition

This backlog is sequenced in **RICE priority** (Reach × Impact × Confidence / Effort). Each task maps to a user story in `docs/spec/SPEC.md`. **Product lead provides story points estimates (L-column) as a starting point; solution architect and tech lead refine during Stage 2–3.**

---

## Legend

| Column | Definition |
|---|---|
| **ID** | Task identifier (DHM-###) |
| **Story** | Linked user story from SPEC.md (Story 1, 2, 3) |
| **Task** | Specific, non-decomposable unit of work |
| **Reach** | Number of deployments affected: 50 = every current service + future = 100 |
| **Impact** | Impact on deployment time/reliability: 3 = eliminates 1 hr, 2 = eliminates 30 min, 1 = minor |
| **Confidence** | Likelihood of estimate accuracy: 50 = high confidence (well-understood), 30 = medium, 10 = low (unclear) |
| **Effort** | Relative effort in team-days: 1 = 2 hrs, 2 = 4 hrs, 3 = 8 hrs, 5 = 1.5 days, 8 = 3 days, 13 = 1 week |
| **RICE** | (Reach × Impact × Confidence) / Effort = priority score (higher = earlier) |
| **Points** | Fibonacci story points (1–13); TL assigns during planning |
| **Status** | Backlog / Ready / In-Progress / Complete |

---

## Priority Stack (Ordered by RICE Score)

| ID | Story | Task | Reach | Impact | Conf. | Effort | RICE | Points | Status |
|---|---|---|---|---|---|---|---|---|---|
| **DHM-001** | Story 1 | **Define deployment state machine & API contract** (API routes, request/response schemas, state transitions) | 100 | 3 | 50 | 5 | 3000 | ? | Ready |
| **DHM-002** | Story 1 | **Design PostgreSQL schema** (deployment records, event log, audit trail, version history) | 100 | 2 | 50 | 3 | 3333 | ? | Ready |
| **DHM-003** | Story 1 | **Implement deployment submission endpoint** (`POST /deployments`, validation, request → DB record) | 100 | 3 | 50 | 5 | 3000 | ? | Ready |
| **DHM-004** | Story 1 | **Implement deployment orchestrator core** (state machine transitions, event log writes, error handling) | 100 | 3 | 50 | 8 | 1875 | ? | Backlog |
| **DHM-005** | Story 2 | **Implement health check probe framework** (HTTP GET, timeout handling, retry logic, status mapping) | 100 | 3 | 30 | 5 | 1800 | ? | Ready |
| **DHM-006** | Story 2 | **Implement automated rollback logic** (detect failure → trigger rollback to previous version, version tracking) | 100 | 3 | 30 | 8 | 1125 | ? | Backlog |
| **DHM-007** | Story 1 | **Build deployment status API** (`GET /deployments/{id}`, status query, history retrieval) | 100 | 2 | 50 | 3 | 3333 | ? | Ready |
| **DHM-008** | Story 2 | **Implement audit log (immutable event stream)** (all deployment events logged, signed, queryable) | 100 | 2 | 50 | 5 | 2000 | ? | Ready |
| **DHM-009** | Story 1 | **Build deployment dashboard UI** (status view, history, real-time updates, responsive design) | 100 | 2 | 30 | 8 | 750 | ? | Backlog |
| **DHM-010** | Story 2 | **Integrate structured logging & observability** (JSON logs, trace IDs, Prometheus metrics export) | 50 | 2 | 50 | 5 | 1000 | ? | Backlog |
| **DHM-011** | Story 1 | **Artifact validation module** (verify artifact exists, checksum validation, accessibility) | 100 | 2 | 50 | 3 | 3333 | ? | Ready |
| **DHM-012** | Story 1 | **Pre-deployment validation checks** (environment config validation, resource availability checks) | 100 | 2 | 30 | 5 | 1200 | ? | Backlog |
| **DHM-013** | Story 3 | **Multi-region orchestrator framework** (region sequencing, canary logic, blast radius isolation) | 50 | 3 | 30 | 8 | 562.5 | ? | Backlog |
| **DHM-014** | Story 1 | **OpenAPI documentation & client generation** (API spec, auto-generated SDK/CLI) | 100 | 1 | 50 | 3 | 1667 | ? | Backlog |
| **DHM-015** | Story 2 | **Manual rollback endpoint & workflow** (`POST /deployments/{id}/rollback`, version selection, approval) | 50 | 2 | 50 | 3 | 1667 | ? | Backlog |
| **DHM-016** | Story 1 | **Database migrations & schema versioning** (Flyway/Liquibase setup, schema evolution) | 100 | 1 | 50 | 2 | 2500 | ? | Backlog |
| **DHM-017** | Story 1 | **Error handling & graceful failure modes** (circuit breaker, timeout handling, fallback responses) | 100 | 2 | 30 | 5 | 1200 | ? | Backlog |
| **DHM-018** | Story 2 | **Notification system** (deployment status notifications to teams: Slack, email, webhook) | 50 | 1 | 50 | 3 | 833 | ? | Backlog |
| **DHM-019** | Story 1 | **Deployment request retry logic** (idempotent requests, request deduplication, retry budgets) | 100 | 1 | 50 | 3 | 1667 | ? | Backlog |
| **DHM-020** | Story 1 | **Integration tests for happy path** (end-to-end deploy request → completion) | 100 | 2 | 50 | 5 | 2000 | ? | Backlog |
| **DHM-021** | Story 2 | **Integration tests for rollback scenario** (deploy → health check failure → rollback → verify) | 100 | 2 | 30 | 5 | 1200 | ? | Backlog |
| **DHM-022** | Story 1 | **Deployment rate limiting & quota enforcement** (per-service rate limits, quota tracking) | 50 | 1 | 50 | 3 | 833 | ? | Backlog |
| **DHM-023** | Story 1 | **Mutual TLS setup & certificate management** (service-to-service auth, cert rotation) | 100 | 1 | 30 | 5 | 600 | ? | Backlog |
| **DHM-024** | Story 1 | **Performance testing & load benchmarking** (concurrent deployments, API response times under load) | 100 | 1 | 30 | 8 | 375 | ? | Backlog |
| **DHM-025** | Story 3 | **Canary deployment strategy implementation** (traffic % control, validation duration, promotion logic) | 50 | 2 | 10 | 8 | 125 | ? | Backlog |

---

## Sprint 1 Candidates (Ready for Stage 3 Sprint Planning)

Tasks with **Status = Ready** and **highest RICE scores** are candidates for Sprint 1 development:

1. **DHM-001** — Define deployment state machine & API contract (RICE 3000)
2. **DHM-002** — Design PostgreSQL schema (RICE 3333)
3. **DHM-003** — Implement deployment submission endpoint (RICE 3000)
4. **DHM-007** — Build deployment status API (RICE 3333)
5. **DHM-011** — Artifact validation module (RICE 3333)
6. **DHM-008** — Implement audit log (RICE 2000)
7. **DHM-005** — Implement health check probe framework (RICE 1800)

**Estimated Sprint 1 Effort:** 32 story points (rough estimate; tech lead refines)

---

## Task Dependencies & Critical Path

```
┌─ DHM-002 (Schema) ──┐
│                     ├─→ DHM-003 (Submit endpoint) ──┐
└─ DHM-001 (API spec)┘                                 ├─→ DHM-004 (Orchestrator core)
                                                       │
┌─────────────────────────────────────────────────────┘
│
├─→ DHM-007 (Status API)
├─→ DHM-005 (Health checks) ──→ DHM-006 (Rollback)
├─→ DHM-008 (Audit log)
└─→ DHM-011 (Artifact validation)

Multi-region (DHM-013) requires DHM-004 + DHM-006 complete first.
```

---

## Assumptions & Risks

### Unvalidated Assumptions (Blockers for Tech Lead)

- **[ASSUMPTION]** NASCO has a centralized artifact registry (image pull authentication, version tracking)
- **[ASSUMPTION]** All services expose a standard health check endpoint (HTTP /health, 200 response)
- **[ASSUMPTION]** Deploy-hub can assume services are already running (does NOT provision infrastructure)
- **[ASSUMPTION]** Multi-region deployments have a defined priority order (will be captured in service config)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Health check endpoint doesn't exist for legacy services | Medium | High (blocks MVP automation) | Design health check adapter pattern for services without native support |
| Rollback fails due to data migrations | Medium | High (data corruption risk) | Implement pre-flight checks for reversible migrations; document rollback limitations per service |
| Deployment orchestrator becomes bottleneck under load | Low | Medium (team perception) | Load testing early; horizontal scaling via task queue (future) |
| Multi-region deployment logic too complex for MVP | Medium | Low (scope to MVP, push to Stage 2) | Keep MVP single-region; multi-region is **Next** phase |

---

## Handoff Block

```yaml
<!-- PDLC-HANDOFF
service: "deploy-hub"
stage: "1-discover"
status: "complete"
gate: "1"
artifacts:
  - "docs/spec/SPEC.md" ✅
  - "docs/planning/ROADMAP.md" ✅
  - "docs/planning/TASKS.md" ✅
completed_at: "2026-05-21T00:00:00Z"
next_agent: "solution-architect"
notes: |
  Gate 1 criteria satisfied:
  ✅ Problem statement includes root cause (manual 4+ hr deployments) and impact (service interruptions, vendor lock-in)
  ✅ 3 user stories with ≥3 testable acceptance criteria each
  ✅ MVP scope explicit: single-region, health check automation, basic rollback, audit trail
  ✅ Out-of-scope prevents disputes: infrastructure provisioning, K8s, observability owned elsewhere
  ✅ 4 critical user journeys identified for E2E test anchors
  ✅ Unvalidated assumptions flagged (artifact registry, health check endpoints, multi-region requirement)
  ✅ RICE-prioritized backlog ready for Stage 2 technical breakdown
  
  Next steps for Solution Architect (Stage 2):
  1. Validate unvalidated assumptions with infrastructure and platform teams
  2. Design REST API contracts and state machine for deployment orchestration
  3. Design database schema for immutable audit trail
  4. Identify external dependencies (artifact registry, service health check contract)
  5. Produce ADR for single-region MVP decision (multi-region pushed to Stage 2)
-->
```
