-- Phase 1: Secure platform foundation
-- Fabricated seed data only; no production HR content.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core identity & RBAC
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  email text UNIQUE NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Integrations & sync
-- ---------------------------------------------------------------------------

CREATE TABLE integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'disconnected',
  last_success_at timestamptz,
  last_error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Durable jobs (Trigger.dev wiring deferred)
-- ---------------------------------------------------------------------------

CREATE TABLE job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  state text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  source_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_run_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Audit (append-oriented)
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user',
  action_type text NOT NULL,
  entity_type text,
  entity_id text,
  before_summary text,
  after_summary text,
  source text NOT NULL DEFAULT 'app',
  error_code text,
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_events_timestamp_idx ON audit_events (timestamp DESC);
CREATE INDEX audit_events_correlation_id_idx ON audit_events (correlation_id);

-- ---------------------------------------------------------------------------
-- Feature flags & settings
-- ---------------------------------------------------------------------------

CREATE TABLE feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI Gateway boundary (no raw prompt text stored)
-- ---------------------------------------------------------------------------

CREATE TABLE ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case text NOT NULL,
  status text NOT NULL,
  model_id text,
  prompt_version text,
  schema_version text,
  classification text,
  store_flag boolean NOT NULL DEFAULT false,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  disposition text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  use_case text NOT NULL,
  version text NOT NULL,
  template_ref text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (use_case, version)
);

CREATE TABLE tool_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  tier text,
  caller_id text,
  status text NOT NULL,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seed: roles
-- ---------------------------------------------------------------------------

INSERT INTO roles (key, name, description) VALUES
  ('administrator', 'Administrator', 'Full platform access for Phase 1 allowlisted operators'),
  ('hr_admin', 'HR Admin', 'HR operations administrator'),
  ('manager', 'Manager', 'Line manager access'),
  ('executive_approver', 'Executive Approver', 'Executive approval workflows'),
  ('read_only', 'Read Only', 'View-only access');

-- ---------------------------------------------------------------------------
-- Seed: permissions
-- ---------------------------------------------------------------------------

INSERT INTO permissions (key, name, description) VALUES
  ('app.access', 'App Access', 'Sign in and use the application shell'),
  ('audit.read', 'Audit Read', 'View audit event log'),
  ('jobs.read', 'Jobs Read', 'View durable job runs'),
  ('integrations.read', 'Integrations Read', 'View integration connection status'),
  ('settings.write', 'Settings Write', 'Modify application settings and feature flags'),
  ('ai.use', 'AI Use', 'Invoke AI Gateway use cases');

-- Map administrator → all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.key = 'administrator';

-- ---------------------------------------------------------------------------
-- Seed: feature flags (AI disabled by default)
-- ---------------------------------------------------------------------------

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('ai.global.enabled', false, 'Master switch for AI Gateway use cases'),
  ('ai.gateway.smoke', false, 'Smoke-test flag for AI Gateway connectivity');

-- ---------------------------------------------------------------------------
-- Seed: integration connections (disconnected)
-- ---------------------------------------------------------------------------

INSERT INTO integration_connections (provider, status) VALUES
  ('jazzhr', 'disconnected'),
  ('gmail', 'disconnected'),
  ('google_calendar', 'disconnected'),
  ('google_drive', 'disconnected'),
  ('adobe_sign', 'disconnected');
