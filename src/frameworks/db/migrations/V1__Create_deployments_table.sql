-- V1__Create_deployments_table.sql
-- Initial schema for deploy-hub
-- Immutable append-only event log pattern

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY,
  service_id VARCHAR(20) NOT NULL,
  target_env VARCHAR(10) NOT NULL,
  artifact_url VARCHAR(256) NOT NULL,
  health_check_url VARCHAR(256) NOT NULL,
  health_check_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message VARCHAR(512),
  previous_deployment_id UUID,
  idempotency_key UUID UNIQUE,
  CONSTRAINT fk_previous_deployment FOREIGN KEY (previous_deployment_id) REFERENCES deployments(id) ON DELETE SET NULL
);

CREATE INDEX idx_deployments_service_id ON deployments(service_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_created_at ON deployments(created_at DESC);
CREATE INDEX idx_deployments_idempotency_key ON deployments(idempotency_key);

CREATE TABLE IF NOT EXISTS deployment_stages (
  id UUID PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  stage_name VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  error_message VARCHAR(512),
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployment_stages_deployment_id ON deployment_stages(deployment_id);
CREATE INDEX idx_deployment_stages_stage_name ON deployment_stages(stage_name);
CREATE INDEX idx_deployment_stages_status ON deployment_stages(status);

CREATE TABLE IF NOT EXISTS service_configs (
  service_id VARCHAR(20) PRIMARY KEY,
  artifact_registry_url VARCHAR(256) NOT NULL,
  health_check_url VARCHAR(256) NOT NULL,
  health_check_timeout_seconds INTEGER NOT NULL DEFAULT 30,
  rollback_strategy VARCHAR(20) NOT NULL DEFAULT 'automatic',
  owner_team VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  operator VARCHAR(255) NOT NULL,
  event_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details JSONB,
  signature VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_deployment_id ON audit_logs(deployment_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_event_at ON audit_logs(event_at DESC);
