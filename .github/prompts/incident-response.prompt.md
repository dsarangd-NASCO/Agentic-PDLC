---
name: incident-response
description: "Direct SRE invocation for incident response. Runs the detect→respond→recover→learn loop. Produces INCIDENT-LOG.md and (for Sev 0/1) POSTMORTEM.md. Use when: an incident is active or was recently resolved. Required: $INCIDENT_DESCRIPTION, $SEVERITY (Sev0/Sev1/Sev2/Sev3), $AFFECTED_SERVICE."
---

# Incident Response

Invoke `sre-on-call` to run the detect→respond→recover→learn loop.

## Parameters

**$INCIDENT_DESCRIPTION** — REQUIRED. What is happening or happened.

{{INCIDENT_DESCRIPTION}}

**$SEVERITY** — REQUIRED. One of: Sev0, Sev1, Sev2, Sev3

{{SEVERITY}}

| Severity | Definition | MTTA Target |
|---|---|---|
| Sev0 | Platform-wide outage, all teams affected | ≤ 5 minutes |
| Sev1 | Shared component down, multiple teams affected | ≤ 15 minutes |
| Sev2 | Single team/service affected, business impact | ≤ 1 hour |
| Sev3 | Non-critical, no immediate business impact | Business hours |

**$AFFECTED_SERVICE** — REQUIRED. Service name.

{{AFFECTED_SERVICE}}

If any parameter is missing, stop:
> "ERROR: $INCIDENT_DESCRIPTION, $SEVERITY, and $AFFECTED_SERVICE are all required."

---

## Execution

### Sev0/Sev1 — Active Incident

1. **Open `INCIDENT-LOG.md`** in `docs/ops/incidents/INCIDENT-YYYYMMDD-HHmm.md`:

```markdown
# Incident: [Short Title]

- Start: [UTC timestamp]
- Severity: Sev N
- Service: $AFFECTED_SERVICE
- Status: Active | Resolved
- Commander: sre-on-call

## Timeline
| UTC Time | Event |
|---|---|
| HH:MM | Incident opened |

## Current Status
[What is happening right now]

## Mitigation Steps Taken
[In progress]
```

2. **Diagnose using Four Golden Signals:**
   - Check error rate spike: Grafana error rate panel
   - Check latency: p99 latency panel
   - Check traffic: requests/sec — is this a traffic spike?
   - Check saturation: CPU, memory, DB connections

3. **Identify likely cause:**
   - Recent deploy? Check GitHub Actions deploy history.
   - Dependency failure? Check SQS queue depth, DB connection pool, third-party API status.
   - Traffic anomaly? Check load balancer access logs in Loki.

4. **Mitigate first, diagnose root cause second:**
   - Bad deploy → rollback via GitHub Actions (re-run previous successful pipeline)
   - DB connection exhaustion → scale ECS tasks down, check connection pool settings
   - Traffic spike → scale ECS task count up

5. **Resolve and close INCIDENT-LOG.md:**
   - Record resolution timestamp
   - Record final impact (users affected, duration)
   - Set status to Resolved

### Sev0/Sev1 — Post-Resolution (Postmortem Required)

Within 10 business days, produce `docs/ops/POSTMORTEM-YYYYMMDD.md`:

- Blameless — root cause is systemic, not human
- Complete timeline
- Root cause analysis (5-whys)
- Action items with owners and due dates
- SLO impact (how much error budget was consumed)

### Sev2 — Standard Incident

Follow steps 1-5 above. Postmortem optional unless SLO error budget impact > 25%.

### Sev3 — Low Priority

Create a backlog ticket. No INCIDENT-LOG.md required unless it escalates.

---

## Post-Incident DORA Update

After every Sev0/Sev1 incident, update `docs/ops/DORA-BASELINE.md`:
- Record time-to-recovery
- Note if this incident affected Change Failure Rate metric
- If CFR > 5% over rolling 30 days: trigger reliability review with product-lead

---

## Outputs

| Severity | INCIDENT-LOG.md | POSTMORTEM.md |
|---|---|---|
| Sev0 | Required | Required within 10 days |
| Sev1 | Required | Required within 10 days |
| Sev2 | Required | Optional |
| Sev3 | Not required | Not required |
