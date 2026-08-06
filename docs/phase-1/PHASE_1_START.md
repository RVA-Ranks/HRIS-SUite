# Phase 1 start — secure platform foundation

**Branch:** `phase-1/secure-platform-foundation`  
**Date:** 2026-08-05

## Assumptions encoded for this slice

1. **Greenfield Next.js scaffold** — App Router, TypeScript, Tailwind v4, Vitest, Playwright are in place.
2. **Supabase may be unprovisioned** — `src/lib/env.ts` validates configuration; `/api/health` reports `partial` when vars are missing; protected UI shows `ErrorState` instead of opaque crashes.
3. **AI Gateway disabled by default** — `AI_GLOBAL_KILL_SWITCH` defaults to on; feature flags `ai.global.enabled` and `ai.gateway.smoke` seeded false; no live OpenAI calls in Phase 1.
4. **Trigger.dev not wired** — `job_runs` table + viewer with empty/disconnected state only.
5. **Pattern C worker auth** — documented in `docs/phase-0/WORKER_AUTHORIZATION.md`; no worker runtime in Phase 1.
6. **Allowlist + admin bootstrap** — `AUTH_ALLOWLIST_EMAILS` controls login eligibility; `AUTH_ADMIN_EMAILS` controls who receives the administrator role. Daniel must be on **both**. Other allowlisted users receive `read_only`.
7. **RLS is mandatory** — foundation tables must not be used without `20260805210000_phase1_rls.sql`. Fail-closed: anon has no policies; authenticated clients are SELECT-only via permission checks; writes go through the service-role admin client on approved server paths.
8. **Repository visibility** — Code Coach prefers a private GitHub repository. **Carl must not change repository visibility** (no private/public toggles). Visibility remains Daniel’s action only. No production HR data in repo.

## Delivered in Phase 1 foundation

- SQL migrations: foundation schema + fail-closed RLS helpers/policies
- Supabase SSR auth middleware and Google OAuth login flow (admin client for bootstrap/audit)
- Operational app shell with per-page `requirePermission` gates
- Central AI Gateway boundary with kill switch, redaction (including nested arrays), and metadata-only `ai_runs` audit
- CI: secret scan, markdown links, lint, typecheck, unit tests, `npm audit`, build, Playwright

## Out of scope (explicit)

- JazzHR / Gmail / recruiting demo modules
- Live Trigger.dev workers
- OpenAI Responses API client implementation
- MCP tools or Approval Center material actions
- Changing GitHub repository visibility

## Manual acceptance (Daniel)

1. Apply **both** migrations in order:
   - `supabase/migrations/20260805000000_phase1_foundation.sql`
   - `supabase/migrations/20260805210000_phase1_rls.sql`  
   Never leave foundation applied without the RLS migration in staging/production.
2. Configure `.env.local` from `.env.example` with Supabase keys, `AUTH_ALLOWLIST_EMAILS`, `AUTH_ADMIN_EMAILS`, and `SUPABASE_SERVICE_ROLE_KEY` (server only).
3. Sign in with Google; confirm allowlist denial audits and role assignment (admin vs read_only).
4. Visit each nav module; confirm permission gates and empty/disconnected states (no fake metrics).
5. Confirm `/api/health` returns `configured` when env is complete.

## Rollback

- Disable access by clearing `AUTH_ALLOWLIST_EMAILS` or revoking Supabase OAuth provider.
- Feature flags remain off by default; AI kill switch remains on.
