---
name: hotfix-release
description: "Partial PDLC chain for hotfixes and patch releases. Skips ideation, planning, and design phases. Goes directly to qa-engineer + security-engineer (parallel) then devops-engineer. Use when: releasing a critical bug fix, security patch, or urgent change that cannot wait for the normal release cycle. Required: $FIX_DESCRIPTION, $AFFECTED_SERVICE."
---

# Hotfix Release

Hotfixes skip Phases 01-04 (ideation, planning, design, build). The fix is assumed to be
already implemented on a hotfix branch. This prompt gates and deploys it.

## Parameters

**$FIX_DESCRIPTION** — REQUIRED. What was fixed and why it is urgent.

{{FIX_DESCRIPTION}}

**$AFFECTED_SERVICE** — REQUIRED. Service name (kebab-case ≤ 20 chars).

{{AFFECTED_SERVICE}}

If either parameter is missing, stop immediately.

---

## Pre-Conditions

Before running this prompt, verify:
- [ ] Hotfix branch exists and code is implemented
- [ ] Hotfix branch name follows: `fix/<short-description>` (Conventional Commits)
- [ ] Commit message follows Conventional Commits: `fix(<scope>): <description>`
- [ ] PR is open against `main`

---

## Execution

### Step 1 — QA + Security (parallel)

Invoke `qa-engineer` and `security-engineer` in parallel against the hotfix branch.

**qa-engineer scope (abbreviated):**
- Regression tests for the specific fix
- Smoke tests on critical user journeys affected
- No new E2E tests required unless the fix changes a critical journey
- Produce abbreviated `docs/qa/HOTFIX-QA-REPORT.md`

**security-engineer scope:**
- Full security scan of changed files
- Dependency audit if any packages were updated
- Produce `docs/security/HOTFIX-SECURITY-REVIEW.md`

**Gate:** No CRITICAL security findings + no BLOCKED regression tests.

### Step 2 — devops-engineer deploys

Invoke `devops-engineer` to:
- Merge PR to main (triggers automatic dev deploy via CI/CD)
- Validate dev deployment is healthy (check ECS service events)
- Manually approve stage deployment
- Brief hold (15-30 min) to validate stage
- Manually approve + get 2 approvals for prod deployment

**Hotfix image tagging:** same schema — `<service>/<component>:<git-sha>-prod`

### Step 3 — Post-Deploy

After prod is healthy:
- Add entry to `docs/ops/MAINTENANCE-LOG.md`
- If the hotfix was triggered by a customer-impacting incident: sre-on-call writes
  an incident summary within 2 business days

---

## Outputs

- `docs/qa/HOTFIX-QA-REPORT.md`
- `docs/security/HOTFIX-SECURITY-REVIEW.md`
- `docs/ops/MAINTENANCE-LOG.md` (updated)
