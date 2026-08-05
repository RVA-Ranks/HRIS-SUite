# Day-1 Queue Decision Memo — Inngest vs Trigger.dev

**Date:** August 5, 2026  
**Owner:** Carl (recommendation) / Daniel (approval)  
**Status:** Recommended — awaiting Daniel approval  
**Context:** Locked stack is Next.js on Vercel + Supabase. Vercel must not be the durable worker.

---

## Recommendation

**Prefer Trigger.dev** for Phase 1+.

**Acceptable alternative:** Inngest, only if Daniel explicitly prefers a single Vercel deploy surface and accepts that every long sync must be designed as short, checkpointed steps from day one.

---

## Job profile for this product

Expected durable work (from the master roadmap):

| Job | Nature | Duration risk |
| --- | --- | --- |
| Nightly Gmail incremental scan | Scheduled, paginated, AI extraction later | Medium–high on large days |
| JazzHR initial / incremental sync | Paginated, rate-limited | High on first full sync |
| Résumé parse / ZIP ingest batches | CPU + I/O heavy | High |
| Webhook reconciliation / retries | Burst, idempotent | Low–medium |
| Handbook distribution follow-ups | Batch, delayed | Medium |
| Sync freshness / failed-job alerts | Scheduled | Low |

Volume for Daniel-only use is low (tens to low hundreds of runs per month), but **individual runs can be long**.

---

## Comparison (evidence-based)

| Criterion | Inngest | Trigger.dev |
| --- | --- | --- |
| Where code runs | In your Vercel serverless functions; Inngest orchestrates | On Trigger.dev managed workers; Vercel only enqueues |
| Timeout exposure | Each step must stay within Vercel limits; long work must be chunked | No Vercel timeout on the job itself |
| Durability model | Event + `step.run()` checkpoints | Task/run model with retries and observability |
| Fits roadmap “Vercel ≠ durable worker” | Partial — durable orchestration, but execution still on Vercel | Strong — execution is off Vercel |
| Local DX | Strong Dev Server | Strong CLI / dashboard |
| Cost shape (Daniel-only) | Step-based; low volume stays cheap | Run-based; low volume stays cheap |
| Supabase access | Same env/secrets as the app | Needs DB/API secrets in Trigger.dev; prefer Supabase via public API + service role, not a private-only DB path |
| Vendor surface | Orchestration vendor | Orchestration + compute vendor |

Sources consulted for architecture/pricing patterns: NextBuild (Mar 2025) Inngest vs Trigger.dev on Vercel; BuildMVPFast (2026) Next.js background-jobs comparison. Exact plan prices change; re-check at account signup.

---

## Why Trigger.dev for HR Command Center

1. **Matches the roadmap boundary.** Phase 0/1 require a durable runner that owns retries, replay, and long/bulk work. Trigger.dev’s execution model does not depend on Vercel function duration.
2. **JazzHR and résumé paths are bulk-first risks.** Full candidate pagination and résumé ingest are exactly the jobs that fail awkwardly when forced into serverless timeouts—even with steps—if chunking is incomplete.
3. **Low run volume.** A personal HR OS does not benefit from Inngest’s high-frequency step economics as much as a public SaaS webhook farm does.
4. **Operator visibility.** Failed syncs, dead-letter/replay, and run history map cleanly to the required admin job-run viewer (app table + Trigger.dev dashboard).

---

## Conditions and controls if Trigger.dev is approved

- All HR business logic stays in shared domain services; Trigger tasks call those services only.
- Persist `job_runs` in Postgres (idempotency key, attempt, state, last error, next retry, source/target IDs) even though Trigger.dev also tracks runs.
- Never put OAuth refresh tokens or JazzHR keys in client code; store in Trigger.dev secrets / Supabase vault equivalent with the same redaction rules as Vercel env.
- Prefer calling Supabase over HTTPS (service role, RLS-aware patterns where applicable) rather than requiring a private network path.
- Vercel Cron may *enqueue* nightly work; Trigger.dev must *execute* it.

---

## If Daniel chooses Inngest instead

Hard requirements:

- Every sync page / message batch / résumé file is its own `step.run()`.
- No single step may assume > Pro timeout budget.
- CI/architecture tests assert that bulk loops are not written as one long step.
- Document that execution still shares Vercel capacity/concurrency with the UI API.

---

## Decision needed from Daniel

Approve **Trigger.dev** as the Phase 1 durable job runner, or select **Inngest** with the constraints above.

Until approved, Phase 1 scaffolding should keep a provider-agnostic `jobs/` boundary and not hard-code vendor SDKs into domain modules.
