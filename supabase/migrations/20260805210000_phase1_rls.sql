-- Phase 1: Fail-closed Row Level Security
-- Apply AFTER 20260805000000_phase1_foundation.sql.
-- Never leave foundation tables without this migration in any shared environment.

-- ---------------------------------------------------------------------------
-- Helper: resolve active app user for the current auth.uid()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
    AND u.status = 'active'
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Helper: permission check (SECURITY DEFINER bypasses RLS on lookup tables;
-- does not call itself — no infinite recursion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_permission(permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  app_user_id uuid;
  allowed boolean;
BEGIN
  app_user_id := public.current_app_user_id();
  IF app_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    INNER JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    INNER JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = app_user_id
      AND p.key = permission_key
  ) INTO allowed;

  RETURN COALESCE(allowed, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Permission seed: settings.read (idempotent)
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (key, name, description)
VALUES (
  'settings.read',
  'Settings Read',
  'View application settings and feature flags'
)
ON CONFLICT (key) DO NOTHING;

-- Administrator receives any newly added permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'administrator'
ON CONFLICT DO NOTHING;

-- read_only: view permissions only (no settings.write, no ai.use)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'read_only'
  AND p.key IN (
    'app.access',
    'audit.read',
    'jobs.read',
    'integrations.read',
    'settings.read'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Enable RLS on every public operational table
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_invocations ENABLE ROW LEVEL SECURITY;

-- No policies for anon → anon cannot read/write operational tables.
-- No INSERT/UPDATE/DELETE policies for authenticated → browser clients are read-only.
-- Service role bypasses RLS for privileged server paths (OAuth bootstrap, audit writes, AI metadata).

-- ---------------------------------------------------------------------------
-- Authenticated SELECT policies
-- ---------------------------------------------------------------------------

CREATE POLICY users_select_own_or_settings_write
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR public.has_permission('settings.write')
  );

-- Own role assignments required so the app can load permissions under RLS.
CREATE POLICY user_roles_select_own
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_app_user_id());

CREATE POLICY roles_select_app_access
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (public.has_permission('app.access'));

CREATE POLICY permissions_select_app_access
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (public.has_permission('app.access'));

CREATE POLICY role_permissions_select_app_access
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (public.has_permission('app.access'));

CREATE POLICY audit_events_select
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (public.has_permission('audit.read'));

CREATE POLICY job_runs_select
  ON public.job_runs
  FOR SELECT
  TO authenticated
  USING (public.has_permission('jobs.read'));

CREATE POLICY integration_connections_select
  ON public.integration_connections
  FOR SELECT
  TO authenticated
  USING (public.has_permission('integrations.read'));

CREATE POLICY sync_runs_select
  ON public.sync_runs
  FOR SELECT
  TO authenticated
  USING (public.has_permission('integrations.read'));

CREATE POLICY feature_flags_select
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('settings.read')
    OR public.has_permission('settings.write')
  );

CREATE POLICY app_settings_select
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('settings.read')
    OR public.has_permission('settings.write')
  );

-- ai_runs, prompt_versions, tool_invocations: RLS enabled, no client policies (deny-by-default).
