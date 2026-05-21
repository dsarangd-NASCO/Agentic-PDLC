# Security Review — deploy-hub

**Date:** 2026-05-21
**Reviewer:** security-engineer agent
**Version:** 1.0.0
**Status:** CONDITIONAL PASS — safe for dev/stage; two HIGH findings must be resolved before production

---

## Executive Summary

The deploy-hub service demonstrates a sound security baseline. No CRITICAL findings were identified: no hardcoded secrets, the container runs as a non-root user (uid 1001), SQL queries use parameterized statements, and input validation is present on all user-controlled fields. The threat model is documented (STRIDE in DESIGN.md).

Two HIGH findings require remediation before production deployment: missing NestJS authorization guards on controllers, and database credentials sourced from plain environment variables rather than AWS Secrets Manager in production contexts. Five MEDIUM findings address CORS hardening, response header hygiene, and structured audit logging. No deployment is blocked for dev or staging.

---

## CRITICAL Findings

**No CRITICAL findings.**

The deploy-gate hook (`block-deploy-on-critical-findings`) is **not triggered**. The pipeline may proceed to dev and staging.

---

## HIGH Findings
*(Must resolve before production deployment)*

| ID | Category | File | Description | Remediation |
|---|---|---|---|---|
| SEC-001 | A01 Broken Access Control | `src/interface-adapters/controllers/DeploymentController.ts` | Controllers are plain TypeScript classes with no NestJS `@UseGuards()` decorator. Authorization relies entirely on upstream middleware — if the middleware is misconfigured or bypassed, all endpoints are open. | Add a `JwtAuthGuard` (or equivalent) directly to the controller or route handlers. Extract and validate `userId` from the verified JWT rather than accepting it as a caller-supplied parameter. |
| SEC-002 | A02 Cryptographic Failures | `src/config/environment.ts` line 22 | `DATABASE_URL` is read from a plain environment variable. On ECS in production, this means the connection string (including credentials) is stored in ECS task definition environment variables, which are visible in the AWS console to any IAM principal with `ecs:DescribeTaskDefinition`. | In production (`NODE_ENV === 'production'`), fetch credentials from AWS Secrets Manager via `secretsmanager.getSecretValue()`. Pass the secret ARN as the only environment variable. Reference the IaC requirements section below. |

---

## MEDIUM Findings

| ID | Category | File | Description | Remediation |
|---|---|---|---|---|
| SEC-003 | A05 Security Misconfiguration | `src/frameworks/http/nest-app.ts` (or equivalent bootstrap) | CORS configuration not visible in reviewed code. If `app.enableCors()` is called without an allowlist, all origins are accepted. | Explicitly set `origin` to the known frontend domain(s). Reject `*` in production. |
| SEC-004 | A05 Security Misconfiguration | Bootstrap / NestJS pipeline | Security response headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP) are not set. | Add `helmet()` middleware to the NestJS bootstrap. |
| SEC-005 | A09 Logging/Monitoring Failures | `src/interface-adapters/controllers/DeploymentController.ts` | Authorization decisions (grant/deny) are not explicitly logged as security events. Structured audit trail is missing for rollback actions. | Emit a `security.authz.granted` / `security.authz.denied` log event on every protected action. Rollback triggers must include `actorId`, `deploymentId`, `timestamp`, and `reason`. |
| SEC-006 | A08 Software Integrity Failures | `.github/workflows/ci-cd.yml`, `codebuild/` | No SBOM generation step. CodeBuild pipeline does not produce a CycloneDX SBOM or sign the container image with `cosign`. | Add `npm run sbom` (using `@cyclonedx/cyclonedx-npm`) and `cosign sign` to the CodeBuild buildspec. Flag as a required devops-engineer task. |
| SEC-007 | A06 Vulnerable Components | `package.json` | No automated dependency audit step (`npm audit`) in the pipeline. Snyk/Dependabot not configured. | Add `npm audit --audit-level=high` to the CodeBuild lint/test stage. Enable Dependabot alerts on the repository. |

---

## LOW / INFORMATIONAL Findings

| ID | Category | File | Description | Remediation |
|---|---|---|---|---|
| SEC-008 | A04 Insecure Design | `docs/architecture/DESIGN.md` | Threat model covers STRIDE but does not address multi-tenancy isolation between different SaaS customers' deployment data. | Add a data isolation threat to the STRIDE model. Ensure `service_id` scoping prevents cross-tenant data access at the use-case layer. |
| SEC-009 | A10 SSRF | `src/use-cases/` | `health_check_url` is user-supplied and used to perform outbound HTTP checks. This is a potential SSRF vector if the URL is not validated. | Validate `health_check_url` against an allowlist of registered service endpoints. Reject private IP ranges (RFC 1918) and loopback addresses. |
| SEC-010 | INFO | `Dockerfile` | `HEALTHCHECK` uses `node -e` inline script. This works but is fragile if the Node binary path changes. | Consider replacing with a dedicated `healthcheck.js` script for maintainability. |

---

## OWASP Top 10 Coverage

| # | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ HIGH | SEC-001: missing `@UseGuards()` on controllers |
| A02 | Cryptographic Failures | ⚠️ HIGH | SEC-002: DATABASE_URL from plain env var in production |
| A03 | Injection | ✅ PASS | Parameterized queries via TypeORM/pg driver; input regex validation on `service_id` |
| A04 | Insecure Design | ✅ PASS (LOW gap) | STRIDE threat model present; multi-tenancy isolation gap noted (SEC-008) |
| A05 | Security Misconfiguration | ⚠️ MEDIUM | CORS and security headers not confirmed hardened (SEC-003, SEC-004) |
| A06 | Vulnerable Components | ⚠️ MEDIUM | No automated audit in pipeline (SEC-007) |
| A07 | Auth Failures | ✅ PASS | Auth mechanism present; JWT tokens used; no session fixation observed |
| A08 | Software Integrity Failures | ⚠️ MEDIUM | No SBOM, no cosign image signing (SEC-006) |
| A09 | Logging/Monitoring Failures | ⚠️ MEDIUM | Structured logging present; security-event-specific logging absent (SEC-005) |
| A10 | SSRF | ⚠️ LOW | `health_check_url` is user-supplied (SEC-009) |

---

## Secrets Scan

**Result: PASS**

All source files, configuration files, and workflow definitions were scanned for hardcoded secrets, API keys, tokens, passwords, and connection strings.

- No secrets found in `src/`
- No secrets found in `.github/workflows/`
- `.env.example` contains only placeholder values — correctly committed
- `DATABASE_URL` defaults in `src/config/environment.ts` point to `localhost` — acceptable for local development only

---

## Container Security

| Check | Status | Notes |
|---|---|---|
| Non-root user | ✅ PASS | `USER nextjs` (uid 1001) set in Dockerfile stage 2 |
| Minimal base image | ✅ PASS | `node:20-alpine` — minimal Alpine-based image |
| No baked secrets | ✅ PASS | No `ARG`/`ENV` secrets; `.dockerignore` present |
| Minimal EXPOSE | ✅ PASS | Only port `3000` exposed |
| Multi-stage build | ✅ PASS | Builder stage separated from runtime stage |
| Signal handling | ✅ PASS | `dumb-init` installed for proper PID 1 signal handling |
| Health check | ✅ PASS | `HEALTHCHECK` defined |

---

## IaC Security Requirements for devops-engineer

The following controls **MUST** be implemented in `infra/` (Terraform). These are not optional.

| Control | Resource | Requirement |
|---|---|---|
| Encryption at rest | RDS PostgreSQL | `storage_encrypted = true`; use AWS-managed KMS key or CMK |
| Encryption in transit | RDS | `require_ssl = true` in parameter group |
| Credentials in Secrets Manager | ECS Task Definition | Mount `DATABASE_URL` from `aws_secretsmanager_secret`; do not use `environment` block for credentials |
| VPC isolation | ECS Tasks + RDS | Deploy in private subnets; no public IP on tasks or DB |
| Security Groups | ALB → ECS, ECS → RDS | ALB: 443 inbound only. ECS tasks: no inbound from internet. RDS: port 5432 from ECS SG only |
| IAM least privilege | ECS Task Role | Grant only `secretsmanager:GetSecretValue` for the specific secret ARN; `logs:CreateLogStream`, `logs:PutLogEvents` |
| No public S3 buckets | Any S3 usage | `block_public_acls = true`, `block_public_policy = true` |
| ALB HTTPS only | Application Load Balancer | Force redirect HTTP → HTTPS; TLS 1.2 minimum policy |
| WAF | ALB | Attach AWS WAF with OWASP Core Rule Set (optional for MVP, required for prod) |
| tfsec/Checkov scan | CI pipeline | Run `tfsec` and `checkov` on every `terraform plan` in CodePipeline |

---

## SBOM Requirements

CycloneDX SBOM generation must be added to the CodeBuild `build` phase:

```bash
npx @cyclonedx/cyclonedx-npm --output-format json --output-file sbom.json
```

Container image must be signed with `cosign` after push to ECR:

```bash
cosign sign --key awskms:///alias/deploy-hub-cosign <image-uri>
```

These are flagged as required tasks for the **devops-engineer** (Stage 6).

---

## Dependency Audit

Key packages reviewed from `package.json`:

| Package | Version | Notes |
|---|---|---|
| `next` | 14.x | Stable; monitor for CVEs in App Router RSC handling |
| `axios` | latest | No known critical CVEs at review time; pin to exact version |
| `uuid` | v4 | ✅ Cryptographically random UUID v4 used — correct |
| `@testcontainers/postgresql` | latest | Dev dependency only — not in production image |
| `zod` | latest | ✅ Schema validation present |

**Action:** Add `npm audit --audit-level=high` to CodeBuild pipeline. No critical vulnerabilities identified at manual review time, but automated scanning is required.

---

## Gate Result

| Gate | Status | Notes |
|---|---|---|
| No CRITICAL findings | ✅ PASS | Deploy not blocked |
| No hardcoded secrets | ✅ PASS | Secrets scan clean |
| Container runs non-root | ✅ PASS | uid 1001 |
| OWASP Top 10 reviewed | ✅ PASS | All 10 categories assessed |
| HIGH findings resolved | ❌ BLOCKED (prod only) | SEC-001 + SEC-002 must be resolved before prod deploy |
| SBOM generated | ❌ PENDING | Delegated to devops-engineer (Stage 6) |
| Dependency audit in pipeline | ❌ PENDING | Delegated to devops-engineer (Stage 6) |

**Overall: CONDITIONAL PASS**
- Dev and staging deployments: ✅ authorized
- Production deployment: ❌ blocked until SEC-001 and SEC-002 are resolved
