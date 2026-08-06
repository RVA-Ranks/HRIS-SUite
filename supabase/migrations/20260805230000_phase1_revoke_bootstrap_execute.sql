-- Phase 1: Restrict bootstrap_oauth_user execute to service_role only.
-- Explicitly revoke from PUBLIC, anon, and authenticated (Supabase default grants).

REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.bootstrap_oauth_user(uuid, text, text, text) TO service_role;

-- Keep helpers callable by authenticated only (not PUBLIC).
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_user_id() FROM anon;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_permission(text) FROM anon;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
