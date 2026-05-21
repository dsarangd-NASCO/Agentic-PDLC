---
name: new-feature
description: "Full PDLC execution chain: takes a business initiative from raw idea to deployed software. Invokes the Conductor which delegates to all 9 role agents in sequence. Required: $BUSINESS_INITIATIVE (2-5 sentence business goal + problem + target users), $SERVICE_NAME (kebab-case ≤ 20 chars). Optional: $TARGET_STACK."
---

# New Feature — Full PDLC Chain

## Parameter Validation

Before starting, validate all required parameters.

**$BUSINESS_INITIATIVE** — REQUIRED.

{{BUSINESS_INITIATIVE}}

If `$BUSINESS_INITIATIVE` is not provided, or is fewer than 2 sentences, stop immediately:
> "ERROR: $BUSINESS_INITIATIVE is required. Provide a 2-5 sentence description covering:
> (1) the business goal, (2) the problem being solved, and (3) the target users.
> Example: 'NASCO needs to modernize its claims submission process. Adjusters currently
> receive FNOL submissions via email with no structured validation, causing 30% rework.
> Target users are claims adjusters and customer service representatives.'"

**$SERVICE_NAME** — REQUIRED.

{{SERVICE_NAME}}

If `$SERVICE_NAME` is not provided, is > 20 characters, or is not kebab-case:
> "ERROR: $SERVICE_NAME must be provided in kebab-case and ≤ 20 characters.
> Naming schema: <env>-<service>-<component> — service segment must be ≤ 20 chars.
> Example: 'claims-api', 'billing-svc', 'auth-gateway'"

**$TARGET_STACK** — OPTIONAL. Defaults to: TypeScript/NestJS + Postgres + AWS ECS on EC2 + GitHub Actions.

{{TARGET_STACK}}

---

## Execution

Once parameters are validated, hand off to the Conductor agent with:

```
Business Initiative: {{BUSINESS_INITIATIVE}}
Service Name: {{SERVICE_NAME}}
Target Stack: {{TARGET_STACK}}
```

The Conductor will execute the full PDLC chain:

1. **product-lead** → SPEC.md + ROADMAP.md + TASKS.md
   - Gate 1: SPEC.md has ≥ 1 user story with ACs + Out of Scope section

2. **solution-architect** → DESIGN.md + ADR-NNN.md + API-CONTRACTS.yaml
   - Gate 2: C4 diagrams + ≥ 1 API path + ADRs for deployment shape + DB

3. **tech-lead** → validated TASKS.md (no task > 2 working days)
   - Gate 3: all tasks have ACs + story points + SPEC.md story links

4. **backend-engineer** + **frontend-engineer** (parallel) → src/ + tests/unit/
   - Gate 4: code exists, API contracts followed

5. **qa-engineer** + **security-engineer** (parallel) → QA-REPORT.md + SECURITY-REVIEW.md
   - Gate 5: no BLOCKED ACs + no CRITICAL security findings

6. **devops-engineer** → .github/workflows/deploy.yml + infra/ + RELEASE-RUNBOOK.md
   - Gate 6: pipeline exists, Terraform written, naming schema compliant

7. **sre-on-call** → RUNBOOK.md + SLO definitions + dashboards
   - Gate 7: ≥ 2 SLOs + runbook + DORA baseline

---

## Expected Artifacts on Completion

```
docs/spec/SPEC.md
docs/planning/ROADMAP.md
docs/planning/TASKS.md
docs/architecture/DESIGN.md
docs/architecture/API-CONTRACTS.yaml
docs/adr/ADR-001.md           ← deployment shape
docs/adr/ADR-002.md           ← database choice
src/                          ← Clean Architecture layers
tests/unit/
tests/integration/
tests/e2e/
docs/qa/QA-REPORT.md
docs/security/SECURITY-REVIEW.md
.github/workflows/deploy.yml
infra/
docs/ops/RELEASE-RUNBOOK.md
docs/ops/RUNBOOK.md
docs/ops/DORA-BASELINE.md
```
