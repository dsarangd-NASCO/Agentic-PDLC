# Deploy-Hub — Roadmap

## Strategic Context

Deploy-hub is the orchestration backbone for NASCO's modernized deployment process. The roadmap is structured to deliver immediate value (single-region deployment automation) in Stage Now, then expand to multi-region resilience and integration depth in subsequent phases.

---

## Now (Sprint 1–3 / Weeks 1–8)

### Theme: MVP Deployment Automation (Single-Region)

| Objective | Key Results | Status | Dependencies |
|---|---|---|---|
| Establish standardized deployment orchestration | KR1: Deploy-hub API accepts and executes ≥ 95% of deployment requests successfully<br/>KR2: Deployment time reduced from 4+ hours to < 45 min (single-region)<br/>KR3: Team ships first production deployment via deploy-hub by end of Sprint 3 | In Planning | None |
| Eliminate manual deployment errors | KR1: Health check validation catches ≥ 90% of deployment misconfigurations pre-deployment<br/>KR2: Automated rollback triggers within 10 min of failure<br/>KR3: Zero unplanned manual interventions in first 10 production deployments | In Planning | Artifact registry finalized |
| Build deployment visibility & audit trail | KR1: 100% of deployments logged immutably with operator, version, timestamp<br/>KR2: Deployment status queryable in < 100ms<br/>KR3: Compliance audit request fulfilled within 1 hour | In Planning | None |

---

## Next (Sprint 4–6 / Weeks 9–16)

### Theme: Multi-Region Coordination & Resilience

| Objective | Key Results | Notes |
|---|---|---|
| Enable canary and staged multi-region rollouts | KR1: Canary deployments isolate ≤ 10% traffic for 15 min validation before proceeding<br/>KR2: Regional deployments respect priority order and pause intervals<br/>KR3: Regional blast radius isolation prevents failed region from affecting others | Requires finalization of artifact registry and multi-region test infrastructure |
| Strengthen rollback automation | KR1: Automated rollback succeeds for ≥ 98% of failure scenarios<br/>KR2: Manual rollback available for edge cases with < 5 min operator action | Depends on health check patterns from Sprint 1–3 learnings |
| Integrate with CI/CD pipeline | KR1: GitHub Actions → Deploy-hub integration reduces deployment request preparation time to < 5 min<br/>KR2: ≥ 70% of deployments triggered via CI/CD (not manual API calls) | Requires CI/CD infrastructure team coordination |

---

## Later (Backlog / Future Phases)

### Theme: Advanced Orchestration & Platform Maturity

| Opportunity | Business Value | Notes |
|---|---|---|
| Cost-aware deployment scheduling | Reduce cloud costs by 15–20% through optimized deployment windows and region selection | Requires cost allocation and chargeback infrastructure |
| AI-driven deployment recommendations | Predict optimal deployment windows, canary sizing, and rollback triggers based on historical patterns | Data science team involvement; requires 6+ months of historical data |
| Multi-cloud deployment support | Reduce vendor lock-in further; enable NASCO to shift workloads between AWS/GCP/Azure | Architectural refactor; future ADR required |
| Advanced traffic management | Progressive deployment with automatic traffic shifting, A/B testing integration, feature flag coordination | Requires coordination with observability platform |
| Deployment approval workflows | Enforce policy gates (e.g., "prod deployments require 2 approvals", "no deployments Fri–Sun") | Upstream from deploy-hub; handled by RBAC system |
| Service mesh integration | Full observability of deployment failures; service-to-service resilience patterns | Requires service mesh infrastructure (Istio/Linkerd) |
| Self-service infrastructure rollout | Platform engineers provision new services without infra-service team involvement | Requires infra-service maturity; separate effort |

---

## Timeline Summary

```
Week 1–2:   Stage 2 (Solution Architecture) — design API, database schema, deployment state machine
Week 3–4:   Stage 3 (Sprint Planning) — break architecture into tasks, estimate effort, assign
Week 5–8:   Stage 4–5 (Build & Test) — MVP development, health check integration, rollback logic
Week 9:     Stage 6 (Deploy MVP to Stage) — deploy-hub itself runs on stage; manual deployment testing
Week 10:    Stage 7 (Hardening) — production readiness, monitoring, incident runbooks
Week 11:    MVP Launch — First production deployment via deploy-hub (controlled, with rollback plan)
Week 12–16: Sprint 4–6 — Multi-region, canary, CI/CD integration
Week 17+:   Later features — cost optimization, AI, multi-cloud
```

---

## Success Criteria for Roadmap

✅ **Go/No-Go Gates:**

- **End of Now (Week 8):** Deploy-hub MVP is production-deployed, handles ≥ 10 production deployments successfully, deployment time averages < 45 min
- **End of Next (Week 16):** Multi-region deployments working for ≥ 3 services, canary strategy validated with no blast-radius incidents
- **Later (Month 6+):** Team velocity increase confirms 25%+ time saved; cost/compliance features adopted by ≥ 50% of internal customers

