# Day-1 Queue Decision Memo — Inngest vs Trigger.dev

**Date:** August 5, 2026 (revised same day after Code Coach review)  
**Owner:** Carl (recommendation) / Daniel (approval)  
**Status:** Recommended — awaiting Daniel Phase 0A approval  
**Security companion:** `WORKER_AUTHORIZATION.md`

---

## Recommendation

**Prefer Trigger.dev Cloud** (or self-host later if policy requires) for Phase 1+ durable jobs.

**Acceptable alternative:** Inngest, if Daniel prefers orchestration-in-Vercel with mandatory short `step.run()` chunks and accepts [Vercel hosting duration limits](https://www.inngest.com/docs/deploy/vercel).

**Do not** use Vercel Cron / serverless functions as the sole durable worker.

---

## Official primary sources

| Topic | Source |
| --- | --- |
| Trigger.dev product model (tasks, retries, no platform timeout on managed workers) | [Trigger.dev docs — Introduction](https://trigger.dev/docs/introduction) |
| Trigger.dev log retention by plan; payload size limits | [Trigger.dev docs — Limits](https://trigger.dev/docs/limits) |
| Trigger.dev security, SOC2/GDPR, encryption, DPA pointer | [Trigger.dev Security](https://trigger.dev/security) |
| Trigger.dev DPA | [Trigger.dev DPA](https://trigger.dev/legal/dpa) |
| Inngest on Vercel — functions hosted on Vercel; configure `maxDuration`; checkpointing guidance | [Inngest — Deploy on Vercel](https://www.inngest.com/docs/deploy/vercel) |

Secondary blog comparisons were removed as decision authorities. Pricing numbers change; re-check vendor pages at signup.

---

## Why Trigger.dev fits this roadmap

1. **Execution off Vercel.** Trigger.dev runs tasks on its workers so long JazzHR pagination, résumé ingest, and Gmail scans are not bound to Vercel function timeouts ([Introduction](https://trigger.dev/docs/introduction)).
2. **Matches roadmap boundary.** Vercel remains UI + short-lived API + cron *enqueue*; the durable runner owns retries/replay.
3. **Low run volume, higher duration risk.** Daniel-only usage is few runs/month but individual syncs can be long — the opposite of high-frequency tiny webhook farms.

---

## Why Inngest remains acceptable (with constraints)

Inngest’s official Vercel docs state functions are hosted on Vercel serverless and recommend configuring `maxDuration`, with checkpointing `maxRuntime` set below that limit ([Deploy on Vercel](https://www.inngest.com/docs/deploy/vercel)). That means:

- Every page/batch must be its own durable step.
- Bulk loops must never run as one long serverless invocation.
- CI/architecture tests should forbid unchunked syncs.

---

## Security design (required with either vendor)

### Payload minimization

Job payloads **ordinarily contain record IDs and control metadata only** — not résumé text, email bodies, compensation data, or other sensitive content. Workers re-fetch through authorized domain services.

### Worker ↔ Supabase boundary

**Selected default: Pattern C** — Trigger.dev workers call the HRIS internal domain API with a dedicated signed automation identity. They must **not** receive `SUPABASE_SERVICE_ROLE_KEY` by default. See `WORKER_AUTHORIZATION.md`.

A general Supabase **service-role** key is exception-only (admin/migration/emergency), never for routine workers.

### Retention, logging, DPA

Before production:

1. Review Trigger.dev [DPA](https://trigger.dev/legal/dpa) and [Security](https://trigger.dev/security) (encryption, subprocessors, deletion).  
2. Select a plan whose [log retention](https://trigger.dev/docs/limits) matches AITHERAS policy (vendor documents Free 1 day / Hobby 7 days / Pro 30 days as of docs fetch).  
3. Ban sensitive fields from task logs and Trigger dashboard outputs.  
4. Document secret ownership (who rotates Trigger.dev and worker DB credentials).

---

## Decision needed from Daniel (Phase 0A)

Approve **Trigger.dev** with the worker authorization document, or select **Inngest** with the Vercel duration constraints above.

Until approved, keep `jobs/` provider-agnostic in any future scaffold.
