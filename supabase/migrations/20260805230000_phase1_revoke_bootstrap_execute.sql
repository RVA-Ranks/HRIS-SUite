-- Phase 1: Restrict bootstrap_oauth_user execute to service_role only.
-- Explicitly revoke from PUBLIC, anon, and authenticated (Supabase default grants).
--
-- Intentional defense-in-depth / upgrade safeguard:
-- Migration 20260805220000 already revokes PUBLIC and grants service_role only.
-- This follow-up re-applies REVOKE against anon and authenticated for databases that
-- may already have applied 20260805220000 under Supabase default privileges that
-- re-granted EXECUTE to those roles. Safe to re-run; idempotent with respect to intent.

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
