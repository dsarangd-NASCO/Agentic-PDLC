# NASCO Platform Engineering — Agent Instructions

These rules are non-negotiable and apply to every agent in this workspace. They are derived from
`platform-team/engineering-policy.md` and `platform-team/developer-guidelines.md` in the
`dsarangd-NASCO/PDLC` research repository. Any deviation requires an ADR in the affected repo.

---

## §1 Trunk-Based Development (TBD)

- `main` is the single integration branch. No long-lived branches.
- Branches live ≤ 2 working days. Raise a blocker if a branch approaches that limit.
- Maximum 3 active branches per repository at any time.
- Every engineer merges to main at least once per working day.
- Incomplete features ship behind feature flags — do not hold a branch open instead.
- No code freezes. Stability comes from tests and flags, not branch locks.

## §2 Continuous Integration

- `main` is always green. A broken build is a stop-the-line event.
- Build pipeline must reach a pass/fail signal on main within 10 minutes.
- Automated checks run before any human code review. Do not comment on things CI already enforces.
- Every PR triggers: lint → type-check → unit tests → integration tests → SAST → build.

## §3 Continuous Delivery

- `main` is always in a releasable state. If it cannot be deployed right now, that is a defect.
- Deployment to dev is automatic on merge to main.
- Deployment to stage and prod is manual with explicit approvals.

## §4 Test-Driven Development

- Red-Green-Refactor cycle for every non-trivial function. Never skip the Refactor step.
- Exploratory spikes are thrown away. If spike code survives, backfill tests before merge.
- Tests assert behavior, not implementation. No testing private internals.

## §5 Test Pyramid

- Many unit tests (milliseconds, isolated, deterministic), fewer integration tests (Testcontainers —
  real Postgres/Redis, not mocks), few E2E tests (Playwright, critical user journeys only).
- 70–80% coverage floor on business logic. Suspicious of >95% — likely testing implementation.
- Every E2E test must cite the critical user journey it protects (from SPEC.md §user-journeys).
- Flaky tests are bugs. Track and fix before merge; do not suppress.

## §6 SOLID Principles (Martin 2020)

- **S** Single Responsibility: a module has one reason to change.
- **O** Open/Closed: open for extension, closed for modification.
- **L** Liskov Substitution: subtypes substitutable for supertypes without altering correctness.
- **I** Interface Segregation: clients should not be forced to depend on interfaces they do not use.
- **D** Dependency Inversion: depend on abstractions, not concretions.

## §7 Clean Architecture — Dependency Rule

Source-code dependencies only point inward:

```
Entities (innermost) ← Use Cases ← Interface Adapters ← Frameworks & Drivers (outermost)
```

- Business rules in `entities/` have zero external dependencies (no frameworks, no DB, no HTTP).
- Application logic in `use-cases/` depends only on entities.
- Controllers, presenters, and repository implementations in `interface-adapters/`.
- Express/NestJS routes, ORM, AWS SDK wrappers in `frameworks/`.
- The Dependency Rule is violated when any inner layer imports from an outer layer.

## §8 Code Review

- PRs: ≤ 400 LOC changed, one concern per PR.
- Respond to review requests within one business day.
- Comment severity labels: `Nit:` (style, non-blocking), `Optional:` (suggestion), unlabeled = blocking.
- Approve when "the code improves the overall health of the codebase" — not when perfect.
- Automated checks must pass before requesting human review.

## §9 Conventional Commits v1.0.0

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`, `build`, `perf`, `style`

Breaking changes: append `!` after type/scope, or add `BREAKING CHANGE:` footer.

Examples:
- `feat(billing): add invoice-export endpoint`
- `fix(auth): handle expired token refresh race condition`
- `refactor(claims)!: rename ClaimDto to ClaimRequest — BREAKING CHANGE: consumers must update imports`

## §10 DORA Elite Targets

- **Deployment Frequency:** on demand (multiple times per day)
- **Change Lead Time:** < 1 day from commit to production
- **Change Failure Rate:** ≤ 5%
- **Mean Time to Recovery:** < 1 hour

## §11 Naming Schema (developer-guidelines §1)

All AWS resources, services, and components:

```
<env>-<service>-<component>[-<qualifier>]
```

- `<env>`: `prod` | `stage` | `dev` | `sandbox` only
- `<service>`: ≤ 20 characters, kebab-case
- Character limits: ALB/TG ≤ 32, IAM role ≤ 64, RDS ≤ 63, SQS ≤ 80

## §12 Terraform Topology (developer-guidelines §4)

- IaC lives in separate repos from application code.
- Repo pattern: `<system>-core` (shared foundations) + `<system>-<component>` (workload-specific).
- Single `infra-aws` GitHub Actions runner using OIDC federation — no long-lived AWS credentials.
- `terraform plan` runs on every PR; `terraform apply dev` auto on merge to main;
  `apply stage/prod` manual with required approvals.
- Cross-repo references via SSM Parameter Store ONLY:
  - `-core` writes: `/infra/<system>/core/<env>/<output-name>`
  - `-component` reads: `data "aws_ssm_parameter"`
  - NEVER use `terraform_remote_state` for cross-repo refs.

## §13 Container Image Tagging (developer-guidelines §5)

```
<service>/<component>:<git-sha>-<env>
```

Same image promoted across environments — never rebuild per environment.

Example: `billing/api:a3f1c2b-prod`

## §14 Required AWS Resource Tags (developer-guidelines §3)

Every AWS resource must carry all 8 tags:
`Environment`, `Service`, `Component`, `Owner`, `CostCenter`, `ManagedBy`, `GitRepo`, `CreatedAt`

## §15 ADR Deviation Policy (engineering-policy §12)

Any override of the above rules requires an ADR (`docs/adr/ADR-NNN.md`) in the affected repo.
ADR format: Title, Date, Status (Proposed|Accepted|Deprecated|Superseded), Context, Decision, Consequences.
The Nygard rule: if reversing the decision later costs more than writing the ADR, write the ADR.

## §16 Default Tech Stack

Do not deviate without an ADR.

| Layer | Default |
|---|---|
| Backend | TypeScript/Node.js + NestJS |
| Backend (ML-adjacent) | FastAPI/Python (requires ADR) |
| Frontend | TypeScript + React + Next.js + Tailwind CSS + shadcn/ui |
| Unit/Integration testing | Vitest + Testing Library + Testcontainers |
| E2E testing | Playwright |
| Contract testing | Pact |
| Performance testing | k6 |
| Database | Single PostgreSQL instance |
| Runtime | AWS ECS on EC2 |
| CI/CD | GitHub Actions |
| Observability | OpenTelemetry → Prometheus + Loki + Tempo + Grafana + Sentry |
| Security scanning | Semgrep/CodeQL + Snyk/Dependabot + Trivy + tfsec/Checkov + CycloneDX SBOM + cosign |
