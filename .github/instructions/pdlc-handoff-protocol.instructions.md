---
applyTo: ".github/agents/**"
---

# PDLC Handoff Protocol

Every agent in this workspace MUST emit a handoff block at the end of its output file before the
Conductor advances to the next stage. The Conductor does not proceed unless `status: complete`.

---

## Handoff Block Format

Append this YAML frontmatter block as the last section of every artifact file the agent produces:

```yaml
<!-- PDLC-HANDOFF
stage: "01-discover"          # phase identifier — see Stage IDs below
status: "complete"            # complete | blocked
artifact: "docs/spec/SPEC.md" # primary output file path (relative to repo root)
blockers: []                  # list of strings; empty when status: complete
next-agent: "solution-architect"  # name of the next agent the Conductor should invoke
completed-at: "2024-01-15T14:32:00Z"  # ISO-8601 UTC
-->
```

When `status: blocked`, `blockers` must be non-empty and `next-agent` must be `"conductor"`:

```yaml
<!-- PDLC-HANDOFF
stage: "03-design"
status: "blocked"
artifact: "docs/architecture/DESIGN.md"
blockers:
  - "API contracts have no paths defined — need product-lead clarification on scope"
  - "ADR for deployment shape not yet decided"
next-agent: "conductor"
completed-at: "2024-01-15T14:32:00Z"
-->
```

---

## Stage IDs

| Stage | ID | Primary Artifact |
|---|---|---|
| Discover | `01-discover` | `docs/spec/SPEC.md` |
| Plan | `02-plan` | `docs/planning/ROADMAP.md` + `docs/planning/TASKS.md` |
| Design | `03-design` | `docs/architecture/DESIGN.md` + `docs/adr/ADR-NNN.md` + `docs/architecture/API-CONTRACTS.yaml` |
| Build | `04-build` | `src/` + `tests/unit/` |
| Test | `05-test` | `tests/integration/` + `tests/e2e/` + `docs/qa/QA-REPORT.md` |
| Security | `05-security` | `docs/security/SECURITY-REVIEW.md` |
| Ship | `06-ship` | `.github/workflows/deploy.yml` + `infra/` + `docs/ops/RELEASE-RUNBOOK.md` |
| Run | `07-run` | `docs/ops/RUNBOOK.md` |
| Evolve | `08-evolve` | `docs/ops/POSTMORTEM.md` + `docs/ops/MAINTENANCE-LOG.md` |

---

## Conductor Gate Rules

The Conductor checks the following before advancing each stage:

### Gate 1 — After `01-discover` → `02-plan`
- `docs/spec/SPEC.md` exists
- Contains ≥ 1 user story in "As a [user] I want [action] so that [outcome]" format
- Contains an "Acceptance Criteria" section with ≥ 1 testable criterion
- Contains an explicit "Out of Scope" section

### Gate 2 — After `02-plan` → `03-design`
- `docs/planning/ROADMAP.md` exists with Now/Next/Later columns
- `docs/planning/TASKS.md` exists with RICE-scored items

### Gate 3 — After `03-design` → `04-build`
- `docs/architecture/DESIGN.md` exists with C4 Context and Container diagram sections
- `docs/architecture/API-CONTRACTS.yaml` exists with ≥ 1 path defined
- ≥ 1 ADR exists in `docs/adr/` covering deployment shape and database choice

### Gate 4 — After `04-build` → `05-test` + `05-security` (parallel)
- `src/` directory exists with code
- `tests/unit/` exists with coverage ≥ 70% on business logic files

### Gate 5 — After `05-test` + `05-security` → `06-ship`
- `docs/qa/QA-REPORT.md` exists
- QA-REPORT.md contains no unresolved BLOCKED acceptance criteria
- `docs/security/SECURITY-REVIEW.md` exists
- SECURITY-REVIEW.md contains no unresolved CRITICAL findings

### Gate 6 — After `06-ship` → `07-run`
- `.github/workflows/deploy.yml` exists
- `infra/` directory exists
- `docs/ops/RELEASE-RUNBOOK.md` exists

### Gate 7 — After `07-run` → Done
- `docs/ops/RUNBOOK.md` exists with alert response procedures
- SLOs defined (≥ 2 per service)
- On-call rotation documented

---

## Blocked State Handling

When a gate fails or an agent emits `status: blocked`:

1. The Conductor surfaces the blockers to the human in plain language.
2. The Conductor does NOT guess past blockers or proceed with incomplete artifacts.
3. The Conductor does NOT restart from step 1 — it restarts from the failed stage only.
4. The human resolves the blocker (or provides the missing information) and re-invokes the
   Conductor with the same parameters.

---

## Artifact Trace

A complete PDLC execution produces this chain:

```
SPEC.md → ROADMAP.md + TASKS.md → DESIGN.md + ADR-001.md + API-CONTRACTS.yaml
→ src/ + tests/unit/ → tests/integration/ + tests/e2e/ + QA-REPORT.md + SECURITY-REVIEW.md
→ .github/workflows/deploy.yml + infra/ + RELEASE-RUNBOOK.md → RUNBOOK.md
```

Any gap in this chain is a blocker. Do not ship with a broken artifact trace.
