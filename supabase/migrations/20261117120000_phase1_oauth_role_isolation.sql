-- Phase 1 security hotfix: exclusive OAuth baseline roles + no self-reactivation.
-- Apply after 20260805230000_phase1_revoke_bootstrap_execute.sql.
-- Fabricated roles only; staff_submitter / hr_reviewer are reserved for Phase 2
-- fabricated testing and must not inherit read_only audit/jobs permissions.

-- ---------------------------------------------------------------------------
-- Seed exclusive restricted roles (app.access only until Phase 2 grants)
-- ---------------------------------------------------------------------------

INSERT INTO public.roles (key, name, description) VALUES
  (
    'staff_submitter',
    'Staff Submitter',
    'Restricted open-item submitter; own submissions only (Phase 2)'
  ),
  (
    'hr_reviewer',
    'HR Reviewer',
    'Restricted open-item reviewer; assigned/queue scope only (Phase 2)'
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key IN ('staff_submitter', 'hr_reviewer')
  AND p.key = 'app.access'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Harden bootstrap_oauth_user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bootstrap_oauth_user(
  p_auth_user_id uuid,
  p_email text,
  p_display_name text,
  p_role_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
  v_existing_status text;
  v_exclusive_roles text[] := ARRAY[
    'administrator',
    'read_only',
    'staff_submitter',
    'hr_reviewer'
  ];
BEGIN
  IF p_role_key IS NULL OR p_role_key <> ALL (v_exclusive_roles) THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: invalid role key %', p_role_key;
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: auth user id is required';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: email is required';
  END IF;

  SELECT u.status INTO v_existing_status
  FROM public.users u
  WHERE u.auth_user_id = p_auth_user_id;

  -- Disabled / revoked accounts must not self-reactivate via OAuth.
  IF v_existing_status IS NOT NULL AND v_existing_status <> 'active' THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: account is %', v_existing_status
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.users (
    auth_user_id,
    email,
    display_name,
    status,
    last_login_at
  )
  VALUES (
    p_auth_user_id,
    lower(trim(p_email)),
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(lower(trim(p_email)), '@', 1)),
    'active',
    now()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    -- Never force status back to active on login; reactivation is admin-only.
    last_login_at = now(),
    updated_at = now()
  WHERE public.users.status = 'active'
  RETURNING id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: account is not active'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT r.id INTO v_role_id
  FROM public.roles r
  WHERE r.key = p_role_key;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: role % not found', p_role_key;
  END IF;

  -- Mutually exclusive baseline roles: exactly one of the exclusive set.
  DELETE FROM public.user_roles ur
  USING public.roles r
  WHERE ur.user_id = v_user_id
    AND ur.role_id = r.id
    AND r.key = ANY (v_exclusive_roles);

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) TO service_role;
