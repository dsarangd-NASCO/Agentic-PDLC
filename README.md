# Deploy-Hub Frontend Dashboard

A production-ready frontend dashboard for the Deploy-Hub deployment orchestration platform. Built with TypeScript, React, Next.js 14, Tailwind CSS, and shadcn/ui components.

## Features

### ✅ Core Functionality
- **Deployment Submission Form** — Submit service artifacts with validation
- **Deployment Status Monitoring** — Real-time polling with 5-second refresh intervals
- **Deployment History** — List all deployments with filtering and search
- **Deployment Timeline** — Visual breakdown of deployment stages
- **Manual Rollback** — Trigger rollbacks with audit trail
- **System Health** — Monitor deploy-hub service health and component status

### ✅ Technical Features
- **Type-Safe API Client** — Typed wrappers around API endpoints
- **React Query Integration** — Efficient server state management and caching
- **Form Validation** — Zod schema validation with react-hook-form
- **Accessible UI** — WCAG 2.1 AA compliant components
- **Responsive Design** — Mobile-first approach with Tailwind CSS
- **Comprehensive Tests** — 18+ unit and integration tests with ≥70% coverage

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+

### Installation

```bash
# Clone repository and navigate
cd deploy-hub

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env.local

# Update .env.local with your API endpoint
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### Development

```bash
# Start development server
npm run dev

# Server runs at http://localhost:3000
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

---

## Project Structure

```
app/                    # Next.js App Router
├── (dashboard)/        # Dashboard layout and routes
│   ├── page.tsx                      # Dashboard home
│   ├── deployments/
│   │   ├── page.tsx                  # Deployment list
│   │   ├── new/
│   │   │   └── page.tsx              # Deployment submission
│   │   └── [id]/
│   │       └── page.tsx              # Deployment detail + polling
│   ├── health/
│   │   └── page.tsx                  # System health
│   └── layout.tsx                    # Dashboard layout with navigation

components/             # React components
├── ui/                 # Base UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── Badge.tsx
│   └── Alert.tsx
├── DeploymentStatusBadge.tsx          # Status display
├── DeploymentTimeline.tsx             # Stage timeline visualization
├── LogViewer.tsx                      # Log viewer with scroll-to-bottom
├── DeploymentForm.tsx                 # Deployment submission form
└── ConfirmRollbackModal.tsx           # Rollback confirmation dialog

lib/                    # Utilities and API client
├── types.ts            # TypeScript type definitions
├── api-client.ts       # Typed API client with axios
├── hooks.ts            # React Query hooks
├── utils.ts            # Formatting and utility functions
```
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