# Phase 1 start — secure platform foundation

**Branch:** `phase-1/secure-platform-foundation`  
**Date:** 2026-08-05

## Assumptions encoded for this slice

1. **Greenfield Next.js scaffold** — App Router, TypeScript, Tailwind v4, Vitest, Playwright are in place.
2. **Supabase may be unprovisioned** — `src/lib/env.ts` validates configuration; `/api/health` reports `partial` when vars are missing; protected UI shows `ErrorState` instead of opaque crashes.
3. **AI Gateway disabled by default** — `AI_GLOBAL_KILL_SWITCH` defaults to on; feature flags `ai.global.enabled` and `ai.gateway.smoke` seeded false; no live OpenAI calls in Phase 1.
4. **Trigger.dev not wired** — `job_runs` table + viewer with empty/disconnected state only.
5. **Pattern C worker auth** — documented in `docs/phase-0/WORKER_AUTHORIZATION.md`; no worker runtime in Phase 1.
6. **Daniel-only allowlist** — `AUTH_ALLOWLIST_EMAILS` comma-separated; callback denies non-allowlisted emails and audits `access_denied`.
7. **Repository visibility** — unchanged; no production HR data in repo.

## Delivered in Phase 1 foundation

- SQL migration with RBAC, audit, integrations, jobs, AI boundary tables + seeds
- Supabase SSR auth middleware and Google OAuth login flow
- Operational app shell (Command Center, Audit, Jobs, Integrations, Settings)
- Central AI Gateway boundary with kill switch and architecture test
- CI: secret scan, markdown links, lint, typecheck, unit tests, build, dependency review

## Out of scope (explicit)

- JazzHR / Gmail / recruiting demo modules
- Live Trigger.dev workers
- OpenAI Responses API client implementation
- MCP tools or Approval Center material actions

## Manual acceptance (Daniel)

1. Apply `supabase/migrations/20260805000000_phase1_foundation.sql` to staging Supabase.
2. Configure `.env.local` from `.env.example` with allowlisted email and Supabase keys.
3. Sign in with Google; confirm allowlist enforcement and administrator role assignment.
4. Visit each nav module; confirm empty/disconnected states (no fake metrics).
5. Confirm `/api/health` returns `configured` when env is complete.

## Rollback

- Disable access by clearing `AUTH_ALLOWLIST_EMAILS` or revoking Supabase OAuth provider.
- Feature flags remain off by default; AI kill switch remains on.
