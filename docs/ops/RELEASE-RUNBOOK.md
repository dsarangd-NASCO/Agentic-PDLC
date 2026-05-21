# Release Runbook — Deploy-Hub

**Version:** 1.0.0  
**Last Updated:** 2026-05-21  
**Target Stack:** AWS CodePipeline + CodeBuild + CodeDeploy  
**Environments:** dev, stage, prod  

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Release Checklist](#pre-release-checklist)
3. [Deployment Procedure](#deployment-procedure)
4. [Verification Steps](#verification-steps)
5. [Rollback Procedure](#rollback-procedure)
6. [Post-Deployment Checklist](#post-deployment-checklist)
7. [Emergency Contacts](#emergency-contacts)
8. [Appendix: Troubleshooting](#appendix-troubleshooting)

---

## Prerequisites

### Required Access & Tools

| Tool/Access | Purpose | How to Get |
|---|---|---|
| **AWS Console Access** | View CodePipeline, ECS, RDS status | Request via IAM onboarding |
| **AWS CLI v2** | Trigger deployments, view logs | `aws --version` (should be ≥ 2.13) |
| **kubectl or AWS Console** | Monitor ECS tasks | Pre-installed in workstation |
| **GitHub Access** | View code, trigger CI | GitHub org membership (dsarangd-NASCO) |
| **Slack Integration** | Deployment notifications | `#deploy-hub-notifications` channel |

### Pre-Flight Checks

```bash
# Verify AWS credentials
aws sts get-caller-identity

# Verify AWS region
aws configure get region
# Expected: us-east-1

# Verify CodePipeline access
aws codepipeline list-pipelines --region us-east-1

# Verify ECS access
aws ecs list-clusters --region us-east-1

# Verify RDS access
aws rds describe-db-instances --region us-east-1 | grep -i deploy-hub
```

---

## Pre-Release Checklist

**⚠️ BLOCKER: Cannot deploy until all checks pass.**

### 1. QA Sign-Off

- [ ] All acceptance criteria in [docs/qa/QA-REPORT.md](../qa/QA-REPORT.md) show **PASS** status
- [ ] No **BLOCKED** ACs (unless explicitly scoped out and documented)
- [ ] Test coverage ≥ 70% for business logic

**How to verify:**
```bash
# Check QA report
cat docs/qa/QA-REPORT.md | grep -E "PASS|FAIL|BLOCKED"
```

### 2. Security Review Sign-Off

- [ ] No **CRITICAL** findings in [docs/security/SECURITY-REVIEW.md](../security/SECURITY-REVIEW.md)
- [ ] All **HIGH** findings resolved or explicitly accepted via ADR
- [ ] SBOM generated and stored

**How to verify:**
```bash
# Check security report
cat docs/security/SECURITY-REVIEW.md | grep -E "CRITICAL|HIGH"
# Expected: No CRITICAL, no unresolved HIGH
```

### 3. Main Branch is Green

- [ ] Latest commit on `main` has passed all GitHub Actions PR checks
- [ ] No pending changes or uncommitted code
- [ ] Git tag matches the version to deploy

**How to verify:**
```bash
# Check main branch status
git status
# Expected: working tree clean

# Check GitHub Actions status
gh run list --workflow=deploy.yml --branch main --limit 1 --json status
# Expected: "completed" with conclusion "success"
```

### 4. Infrastructure is Ready

- [ ] Terraform plan shows no unexpected changes
- [ ] VPC, RDS, ALB, ECS cluster all provisioned in target environment
- [ ] Database migrations have been tested in staging

**How to verify:**
```bash
# Verify core infrastructure
aws ec2 describe-vpcs --filters "Name=tag:Service,Values=deploy-hub" \
  --query "Vpcs[0].VpcId"

# Verify RDS
aws rds describe-db-instances \
  --query "DBInstances[?contains(DBInstanceIdentifier, 'deploy-hub')].DBInstanceStatus"

# Verify ECS cluster
aws ecs describe-clusters --clusters dev-deploy-hub-cluster \
  --query "clusters[0].status"
```

### 5. Secrets Are Configured

- [ ] Database credentials stored in AWS Secrets Manager
- [ ] ACM certificate provisioned and valid
- [ ] KMS keys created and accessible

**How to verify:**
```bash
# Check Secrets Manager
aws secretsmanager list-secrets --query "SecretList[?Name=='*deploy-hub*'].Name"

# Check ACM certificate
aws acm list-certificates --query "CertificateSummaryList" | grep deploy-hub

# Check KMS keys
aws kms describe-key --key-id alias/dev-deploy-hub-rds
```

---

## Deployment Procedure

### Option A: Deploy via AWS Console (Recommended for First-Time Users)

#### Step 1: Navigate to CodePipeline

1. Open [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **CodePipeline** → **Pipelines**
3. Select `dev-deploy-hub-pipeline` (or `stage-deploy-hub-pipeline`, `prod-deploy-hub-pipeline`)

#### Step 2: Trigger Pipeline Execution

1. Click **Release Change** button (top-right)
2. Confirm the source branch is `main`
3. Click **Release**

```
⏳ Pipeline will start immediately
Expected duration: 45 minutes (25 min build, 15 min deploy, 5 min verify)
```

#### Step 3: Monitor Execution

1. Pipeline enters **Source** stage (fetches code from CodeCommit)
2. Pipeline enters **Build** stage (CodeBuild: lint, test, SAST, build image, push ECR)
3. Pipeline enters **Deploy** stage (CodeDeploy: rolling deployment to ECS)

Each stage shows:
- Status: In Progress / Succeeded / Failed
- Start/End time
- Logs link (click "View logs in CodeBuild")

### Option B: Deploy via AWS CLI

```bash
# Start pipeline execution
PIPELINE_NAME="dev-deploy-hub-pipeline"
EXECUTION_ID=$(aws codepipeline start-pipeline-execution \
  --name $PIPELINE_NAME \
  --region us-east-1 \
  --query 'pipelineExecutionId' \
  --output text)

echo "Pipeline execution started: $EXECUTION_ID"

# Poll for status (refresh every 30 seconds)
watch -n 30 aws codepipeline get-pipeline-state \
  --name $PIPELINE_NAME \
  --region us-east-1 \
  --query 'stageStates[].{Stage:stageName,Status:latestExecution.status}'
```

### Option C: Deploy via GitHub CLI

```bash
# Trigger via GitHub workflow dispatch (if configured)
gh workflow run deploy.yml \
  --ref main \
  --raw-field environment=dev \
  --raw-field dry_run=false
```

---

## Verification Steps

### 1. Verify ECS Service Deployment (5–10 min)

```bash
# Check ECS service status
SERVICE_NAME="dev-deploy-hub-service"
CLUSTER_NAME="dev-deploy-hub-cluster"

aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --query "services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}"

# Expected:
# Status: ACTIVE
# DesiredCount: 2 (or configured count)
# RunningCount: 2 (same as desired)
# PendingCount: 0
```

### 2. Verify ALB Target Health (2–3 min)

```bash
# Check target group health
TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
  --names dev-deploy-hub-tg \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text)

aws elbv2 describe-target-health \
  --target-group-arn $TARGET_GROUP_ARN \
  --query "TargetHealthDescriptions[].{TargetId:Target.Id,State:TargetHealth.State,Reason:TargetHealth.Reason}"

# Expected: All targets show State=healthy
```

### 3. Health Check Endpoint (manual)

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names dev-deploy-hub-alb \
  --query "LoadBalancers[0].DNSName" \
  --output text)

# Test /health endpoint
curl -v https://$ALB_DNS/health

# Expected:
# HTTP/1.1 200 OK
# Content-Type: application/json
# { "status": "ok", "timestamp": "2026-05-21T..." }
```

### 4. CloudWatch Logs

```bash
# Tail ECS logs (last 100 lines)
aws logs tail /ecs/dev-deploy-hub \
  --follow \
  --max-items 100

# Search for errors
aws logs filter-log-events \
  --log-group-name /ecs/dev-deploy-hub \
  --filter-pattern "ERROR" \
  --start-time $(($(date +%s000) - 600000)) \
  --end-time $(date +%s000)
```

### 5. RDS Connectivity

```bash
# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier dev-deploy-hub-db \
  --query "DBInstances[0].{Status:DBInstanceStatus,Engine:Engine,Endpoint:Endpoint.Address}"

# Test connection from EC2 instance (via SSM)
# Note: RDS is in private subnet, so test must run from inside VPC

# Option: SSH into EC2 instance and test
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-xxxxxxxxx \
  --os-user ec2-user \
  --ssh-public-key-file ~/.ssh/id_rsa.pub \
  --availability-zone us-east-1a

# Then: psql -h <RDS_ENDPOINT> -U postgres -d deployhub
```

### 6. Container Image Verification

```bash
# Verify image in ECR
aws ecr describe-images \
  --repository-name dev-deploy-hub-api \
  --query "imageDetails[0].{Tag:imageTags[0],Size:imageSizeInBytes,Pushed:imagePushedAt}"

# Scan image for vulnerabilities
aws ecr start-image-scan \
  --repository-name dev-deploy-hub-api \
  --image-id imageTag=latest \
  --query 'imageScanningConfiguration'
```

---

## Rollback Procedure

### Automatic Rollback (On Failure)

CodePipeline + CodeDeploy will **automatically rollback** if:
- CodeBuild stage fails (lint, test, security scans)
- CodeDeploy health checks fail
- ECS service fails to reach desired count

**Monitor automatic rollback:**
```bash
# Check pipeline execution status
EXECUTION_ID="<pipeline-execution-id>"

aws codepipeline get-pipeline-execution \
  --pipeline-name dev-deploy-hub-pipeline \
  --pipeline-execution-id $EXECUTION_ID \
  --query "pipelineExecution.status"

# Expected: FAILED (if rollback was triggered)
```

### Manual Rollback (If Needed)

#### Scenario: Deployment completed but service has critical issues

**Step 1: Identify Previous Good Revision**

```bash
# List CodeDeploy deployments
aws deploy list-deployments \
  --application-name dev-deploy-hub-app \
  --deployment-group-name dev-deploy-hub-deployment-group \
  --query "deployments[-5:]" \
  --output text

# Get details of previous successful deployment
PREVIOUS_DEPLOYMENT_ID="d-XXXXXXXXX"

aws deploy get-deployment \
  --deployment-id $PREVIOUS_DEPLOYMENT_ID \
  --query "deploymentInfo.{Status:status,Creator:creator,CreateTime:createTime,RevisionInfo:revision}"
```

**Step 2: Update ECS Task Definition to Previous Version**

```bash
# List task definition revisions
SERVICE_NAME="dev-deploy-hub-service"
CLUSTER_NAME="dev-deploy-hub-cluster"

aws ecs describe-task-definition \
  --task-definition dev-deploy-hub \
  --query "taskDefinition.revision"

# Get previous task definition (e.g., revision 5)
aws ecs describe-task-definition \
  --task-definition dev-deploy-hub:5 \
  --query "taskDefinition.taskDefinitionArn"

# Update service to use previous task definition
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition dev-deploy-hub:5 \
  --force-new-deployment
```

**Step 3: Verify Rollback**

```bash
# Wait for new tasks to start
sleep 30

# Check service status
aws ecs describe-services \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --query "services[0].{RunningCount:runningCount,PendingCount:pendingCount}"

# Test health endpoint
curl https://$ALB_DNS/health
```

#### Scenario: Rollback to Previous Git Commit

```bash
# If the entire deployment was faulty, roll back the code commit

# Get previous commits
git log --oneline main | head -5

# Switch to previous commit
git checkout <COMMIT_SHA>
git push origin HEAD:main

# This will trigger a new pipeline execution with the previous code
```

---

## Post-Deployment Checklist

### Immediate (First 5 Minutes)

- [ ] All ECS tasks are running (desired count = running count)
- [ ] ALB reports all targets as healthy
- [ ] No ERROR level logs in CloudWatch
- [ ] `/health` endpoint responds with 200 OK
- [ ] Deployment time recorded in deployment tracking system

### Short-Term (Next 30 Minutes)

- [ ] No alert spikes in CloudWatch / Grafana
- [ ] No error spikes in application logs
- [ ] Database connection pool is stable
- [ ] API response times are within SLO (P99 < 500ms)
- [ ] No customer-facing incidents reported

### Long-Term (Next 24 Hours)

- [ ] Zero regressions in critical user journeys
- [ ] Deployment metrics recorded in DORA dashboard
- [ ] Change Lead Time < 1 day (from commit to production)
- [ ] Zero post-deployment security findings
- [ ] Post-deployment runbook documented if any issues occurred

### Rollback Decision

**Immediate rollback if ANY of these occur:**
- ❌ Health check endpoint returns non-200 status
- ❌ Database connectivity fails
- ❌ Application crashes (OOM, panic, unhandled exception)
- ❌ Critical security vulnerability discovered post-deployment
- ❌ Customer-facing service degradation (>5% error rate)

**Notify team lead immediately if rollback is triggered.**

---

## Emergency Contacts

| Role | Name | Slack | On-Call |
|---|---|---|---|
| **Platform Lead** | [TBD] | @platform-lead | Check PagerDuty |
| **DevOps Engineer** | [TBD] | @devops-eng | Check PagerDuty |
| **Security Engineer** | [TBD] | @security | Check PagerDuty |
| **On-Call Rotation** | Escalation | Check #deploy-hub-oncall | PagerDuty |

**Escalation Path (for critical production issues):**
1. **Minute 0–5:** Notify DevOps engineer via Slack
2. **Minute 5–15:** If unresolved, trigger automatic rollback (CodeDeploy)
3. **Minute 15+:** Page on-call team lead via PagerDuty

---

## Appendix: Troubleshooting

### Problem: CodeBuild Stage Fails

**Symptom:** Pipeline shows "FAILED" in Build stage

**Diagnosis:**
```bash
# Check CodeBuild logs
aws codebuild batch-get-builds \
  --ids <BUILD_ID> \
  --query "builds[0].logs.cloudWatchLogs.groupName"

# Tail logs
aws logs tail /aws/codebuild/dev-deploy-hub-build --follow
```

**Common Causes & Solutions:**

| Cause | Solution |
|---|---|
| npm audit found HIGH severity CVE | Update vulnerable package in package.json, re-run tests locally, push new commit |
| tfsec found CRITICAL issue in infra/ | Review infra code, fix security issue, commit and push |
| Docker build fails | Check Dockerfile for syntax errors, verify base image exists in ECR |
| ECR push fails (403 Forbidden) | Verify CodeBuild IAM role has ecr:PutImage permission |

### Problem: CodeDeploy Stage Fails

**Symptom:** Pipeline shows "FAILED" in Deploy stage

**Diagnosis:**
```bash
# Check CodeDeploy deployment status
aws deploy get-deployment \
  --deployment-id d-XXXXXXXXX \
  --query "deploymentInfo.{Status:status,ErrorInformation:errorInformation}"

# Check ECS service events
aws ecs describe-services \
  --cluster dev-deploy-hub-cluster \
  --services dev-deploy-hub-service \
  --query "services[0].events[:5]"
```

**Common Causes & Solutions:**

| Cause | Solution |
|---|---|
| Task fails to start (OOM) | Increase container memory in task definition, redeploy |
| Task fails to register with ALB | Verify /health endpoint responds with 200, check security groups |
| Database connection fails | Check DATABASE_URL in Secrets Manager, verify RDS is running |
| image pull error from ECR | Verify image exists in ECR, check CodeBuild pushed image with correct tag |

### Problem: Application Errors After Deployment

**Symptom:** Deployment succeeds but health checks start failing

**Diagnosis:**
```bash
# Check ECS task logs
TASK_ID=$(aws ecs list-tasks \
  --cluster dev-deploy-hub-cluster \
  --service-name dev-deploy-hub-service \
  --query "taskArns[0]" \
  --output text)

aws ecs describe-tasks \
  --cluster dev-deploy-hub-cluster \
  --tasks $TASK_ID \
  --query "tasks[0].{Status:lastStatus,StoppedReason:stoppedReason}"

# Tail logs
aws logs tail /ecs/dev-deploy-hub --follow
```

**Action:** Trigger manual rollback (see [Rollback Procedure](#rollback-procedure))

### Problem: ALB Targets Show Unhealthy

**Symptom:** Target group shows "unhealthy" status

**Diagnosis:**
```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --query "TargetHealthDescriptions[].{TargetId:Target.Id,State:TargetHealth.State,Reason:TargetHealth.Reason,Description:TargetHealth.Description}"
```

**Common Reasons:**

| Reason | Solution |
|---|---|
| `Health checks failed with these codes: [502]` | Task crashed or /health endpoint not responding; check ECS logs |
| `Target registration is still in progress.` | Wait 30–60 seconds for initial health check grace period |
| `Target has failed at least 2 health checks consecutively.` | Increase health check interval, reduce threshold, or fix application |
| `Target is in an availability zone that is not enabled for the load balancer.` | Verify task subnet matches ALB subnet AZ configuration |

---

## Appendix: DORA Metrics Tracking

After each deployment, record these metrics for the DORA dashboard:

```bash
# Template for metrics submission
cat > deployment_metrics.json << EOF
{
  "deployment_id": "$(date +%s)",
  "environment": "prod",
  "service": "deploy-hub",
  "version": "$(git rev-parse --short HEAD)",
  "deployment_start_time": "2026-05-21T10:00:00Z",
  "deployment_end_time": "2026-05-21T10:45:00Z",
  "deployment_duration_minutes": 45,
  "result": "success",
  "lead_time_minutes": 120,
  "mean_time_to_recovery_minutes": 0,
  "change_failure_rate": 0.0
}
EOF

# Submit to monitoring system
# curl -X POST https://metrics.internal/deployments \
#   -H "Content-Type: application/json" \
#   -d @deployment_metrics.json
```

---

**Document Version:** 1.0.0 | **Last Review:** 2026-05-21 | **Next Review:** 2026-06-21
