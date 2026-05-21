# Agentic PDLC — NASCO Platform Engineering

A suite of VS Code Custom Agents that simulate a lean engineering team capable of executing a
business use case end-to-end from ideation to deployed software on AWS ECS/EC2.

All agents enforce the hard engineering rules from the NASCO platform engineering policies.

---

## Quick Start

Open this repo in VS Code with GitHub Copilot. Type `/` in the chat panel to invoke a prompt.

### Run the full PDLC chain

```
/new-feature
```

You will be prompted for:
- **$BUSINESS_INITIATIVE** (required) — 2-5 sentences: business goal + problem + target users
- **$SERVICE_NAME** (required) — kebab-case, ≤ 20 characters
- **$TARGET_STACK** (optional) — defaults to TypeScript/NestJS + Postgres + ECS on EC2

**Example:**
```
Business Initiative: NASCO needs to modernize its claims submission process. Adjusters currently
receive FNOL submissions via email with no structured validation, causing 30% rework. Target
users are claims adjusters and customer service representatives.

Service Name: claims-api
```

---

## Agent Team

The Conductor is the only agent you invoke directly. It delegates to all 9 role agents.

```
Human
  └─ Conductor (orchestrator)
       ├─ product-lead          (Phase 01-02: Discover + Plan)
       ├─ solution-architect    (Phase 03: Design)
       ├─ tech-lead             (Phase 04: Task decomposition + code review)
       ├─ backend-engineer  ┐   (Phase 04: Build — parallel)
       ├─ frontend-engineer ┘
       ├─ qa-engineer       ┐   (Phase 05: Test + Security — parallel)
       ├─ security-engineer ┘
       ├─ devops-engineer       (Phase 06: Ship)
       └─ sre-on-call           (Phase 07-08: Run + Evolve)
```

---

## Agents

| Agent | Role | Key Output |
|---|---|---|
| `conductor` | Orchestrator — sole human entry point | Runs the full chain, gates each phase |
| `product-lead` | PM / Product Lead | `SPEC.md`, `ROADMAP.md`, `TASKS.md` |
| `solution-architect` | Staff Engineer | `DESIGN.md`, `ADR-NNN.md`, `API-CONTRACTS.yaml` |
| `tech-lead` | Senior Engineer | Validated `TASKS.md`, code review |
| `backend-engineer` | Backend / Full-stack | `src/`, `tests/unit/` |
| `frontend-engineer` | Design Engineer | `app/`, `tests/unit/` |
| `qa-engineer` | SDET | `tests/integration/`, `tests/e2e/`, `QA-REPORT.md` |
| `security-engineer` | Security Engineer | `SECURITY-REVIEW.md` |
| `devops-engineer` | Platform Engineer | `.github/workflows/deploy.yml`, `infra/`, `RELEASE-RUNBOOK.md` |
| `sre-on-call` | SRE | `RUNBOOK.md`, SLOs, dashboards, postmortems |

---

## Prompts

| Prompt | Use Case | Required Parameters |
|---|---|---|
| `/new-feature` | Full PDLC chain — new feature or service | `$BUSINESS_INITIATIVE`, `$SERVICE_NAME` |
| `/architecture-review` | Partial chain — architect + tech-lead only | `$SYSTEM_TO_REVIEW`, `$CHANGE_DESCRIPTION` |
| `/hotfix-release` | Partial chain — QA + security + DevOps | `$FIX_DESCRIPTION`, `$AFFECTED_SERVICE` |
| `/incident-response` | Direct SRE invocation | `$INCIDENT_DESCRIPTION`, `$SEVERITY`, `$AFFECTED_SERVICE` |

---

## Quality Gate Hooks

Hooks enforce hard rules automatically — they run before agent tool calls.

| Hook | Trigger | Action |
|---|---|---|
| `validate-spec-has-acs` | Write to `src/` or `tests/` | **BLOCKS** if `SPEC.md` has no acceptance criteria |
| `validate-design-has-api-contracts` | Write to `src/` or `app/` | **BLOCKS** if `API-CONTRACTS.yaml` has no paths |
| `warn-branch-lifetime` | Git operations | **WARNS** if branch > 2 working days (TBD policy) |
| `block-deploy-on-critical-findings` | Write to `infra/` or `.github/workflows/` | **BLOCKS** if `SECURITY-REVIEW.md` has unresolved CRITICAL findings |

---

## Artifact Chain

A complete PDLC execution produces this artifact chain:

```
docs/spec/SPEC.md
docs/planning/ROADMAP.md + TASKS.md
docs/architecture/DESIGN.md + API-CONTRACTS.yaml + docs/adr/ADR-*.md
src/ (Clean Architecture layers) + tests/unit/
tests/integration/ + tests/e2e/ + tests/contract/
docs/qa/QA-REPORT.md
docs/security/SECURITY-REVIEW.md
.github/workflows/deploy.yml + infra/
docs/ops/RELEASE-RUNBOOK.md + RUNBOOK.md + DORA-BASELINE.md
```

---

## Engineering Rules (Summary)

All agents enforce these rules. Full details in `.github/copilot-instructions.md`.

| Rule | Spec |
|---|---|
| Branching | TBD — branches ≤ 2 working days, merge daily |
| CI | ≤ 10 min to signal, stop-the-line on broken main |
| CD | `main` always releasable; dev auto-deploys on merge |
| TDD | Red-Green-Refactor — never skip refactor |
| Tests | Unit > Integration (Testcontainers) > E2E (Playwright, critical journeys only) |
| Coverage | 70–80% floor on business logic |
| Architecture | Clean Architecture — Dependency Rule (inner layers never import outer) |
| PR size | ≤ 400 LOC, one concern, respond ≤ 1 business day |
| Commits | Conventional Commits v1.0.0 |
| Naming | `<env>-<service>-<component>`, service ≤ 20 chars kebab-case |
| Containers | `<service>/<component>:<git-sha>-<env>` — same image promoted, never rebuilt |
| Terraform | `-core` + `-component` repos, SSM for cross-repo refs, OIDC federation |
| DORA | Deploy on demand, < 1 day lead time, ≤ 5% CFR, < 1hr recovery |
| Deviations | Any deviation requires an ADR in the affected repo |

---

## Default Tech Stack

| Layer | Default |
|---|---|
| Backend | TypeScript/Node.js + NestJS |
| Frontend | TypeScript + React + Next.js + Tailwind CSS + shadcn/ui |
| Database | PostgreSQL (single instance) |
| Runtime | AWS ECS on EC2 |
| CI/CD | GitHub Actions |
| Observability | OTel → Prometheus + Loki + Tempo + Grafana + Sentry |
| Security scanning | Semgrep/CodeQL + Snyk + Trivy + tfsec + CycloneDX SBOM + cosign |

---

## Grounded In

This agent team is grounded in verified research from the
[dsarangd-NASCO/PDLC](https://github.com/dsarangd-NASCO/PDLC) research repository:
- `handbook/` — all 8 PDLC phases (discover → evolve) with process companions
- `platform-team/engineering-policy.md` — all hard engineering rules
- `platform-team/developer-guidelines.md` — naming schema, AWS limits, Terraform topology
- `techstacks/` — verified tooling decisions across backend, frontend, testing, cloud, IaC,
  observability, security, and CI/CD