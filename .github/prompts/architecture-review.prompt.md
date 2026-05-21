---
name: architecture-review
description: "Partial PDLC chain: solution-architect + tech-lead only. Reviews an existing system design or evaluates a proposed architecture change. Use when: reviewing an existing service design, evaluating a major architectural change, or getting a second opinion on technology choices. Required: $SYSTEM_TO_REVIEW, $CHANGE_DESCRIPTION."
---

# Architecture Review

## Parameters

**$SYSTEM_TO_REVIEW** — REQUIRED. Name or path of the system/service being reviewed.

{{SYSTEM_TO_REVIEW}}

**$CHANGE_DESCRIPTION** — REQUIRED. What change is being proposed or reviewed.

{{CHANGE_DESCRIPTION}}

If either parameter is missing, stop:
> "ERROR: Both $SYSTEM_TO_REVIEW and $CHANGE_DESCRIPTION are required."

---

## Execution

### Phase 1 — solution-architect reviews

Invoke `solution-architect` to assess:

1. **Alignment with existing architecture:**
   - Does the proposed change violate the Dependency Rule (Clean Architecture §7)?
   - Does it introduce new cross-service coupling that wasn't in the original DESIGN.md?
   - Does it deviate from platform defaults (monolith-first, single Postgres, ECS on EC2)?
     → If yes, is there an ADR for the deviation?

2. **ADR assessment:**
   - Which existing ADRs does this change affect?
   - Does the change require a new ADR? (Apply the Nygard rule: if reversing later costs more
     than writing the ADR, write it now.)

3. **API contract impact:**
   - Does the change break any existing paths in `API-CONTRACTS.yaml`?
   - Are any new endpoints needed? If so, update the contract before implementation.

4. **Threat model delta:**
   - Does the change introduce new trust boundaries?
   - OWASP Top 10 applicability for the changed surface?

### Phase 2 — tech-lead reviews for implementation feasibility

Invoke `tech-lead` to assess:

1. **Task decomposition viability:**
   - Can the change be implemented in tasks of ≤ 2 working days each?
   - What existing code must change? Any SOLID violations in the proposed approach?

2. **Test impact:**
   - Which existing tests will break?
   - What new tests are required (unit, integration, contract)?

3. **Risk assessment:**
   - What is the rollback path if this change causes a production incident?
   - Is a feature flag appropriate?

---

## Outputs

- `docs/adr/ADR-NNN.md` (if new ADR required)
- Updated `docs/architecture/DESIGN.md` (if architecture diagram changes)
- Updated `docs/architecture/API-CONTRACTS.yaml` (if API surface changes)
- Review summary in `docs/decisions/ARCH-REVIEW-YYYYMMDD.md`
