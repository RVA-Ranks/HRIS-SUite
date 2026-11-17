-- Phase 1: OAuth bootstrap via SECURITY DEFINER RPC (service_role only)
-- Apply AFTER 20260805210000_phase1_rls.sql.
-- Hardens helper EXECUTE grants and centralizes first-login user/role bootstrap.

-- ---------------------------------------------------------------------------
-- Revoke PUBLIC execute on RLS helpers; re-grant to authenticated only
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- OAuth bootstrap: upsert app user + mutually exclusive bootstrap roles
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
BEGIN
  IF p_role_key IS NULL OR p_role_key NOT IN ('administrator', 'read_only') THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: invalid role key %', p_role_key;
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: auth user id is required';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: email is required';
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
    status = 'active',
    last_login_at = now(),
    updated_at = now()
  RETURNING id INTO v_user_id;

  SELECT r.id INTO v_role_id
  FROM public.roles r
  WHERE r.key = p_role_key;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'bootstrap_oauth_user: role % not found', p_role_key;
  END IF;

  -- Mutually exclusive bootstrap roles: drop administrator/read_only, keep others.
  DELETE FROM public.user_roles ur
  USING public.roles r
  WHERE ur.user_id = v_user_id
    AND ur.role_id = r.id
    AND r.key IN ('administrator', 'read_only');

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
-- Intentionally NOT granted to authenticated or anon.
