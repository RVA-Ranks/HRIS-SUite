# Worker authorization boundary (Trigger.dev + Supabase)

**Status:** Phase 0A — **Pattern C selected** as preliminary default (provisionally approve with 0A)  
**Related:** `QUEUE_DECISION_MEMO.md`

---

## Selected default: Pattern C

**Trigger.dev workers call the HRIS internal domain API with a dedicated signed automation identity.** They do **not** impersonate Daniel. They do **not** receive `SUPABASE_SERVICE_ROLE_KEY` by default.

```text
Vercel Cron / schedule / admin "Run now"
        │
        ▼
Trigger.dev task (payload = IDs + control metadata only)
        │  signed automation JWT / client credentials
        ▼
HRIS internal API (same domain services as UI)
        │  permission + classification checks
        ▼
Supabase (user/session RLS or scoped service paths inside API only)
```

### Automation identity rules

| Rule | Requirement |
| --- | --- |
| Identity | Dedicated automation principal (e.g. `automation@hris.internal` / machine client) — **not** Daniel’s user session |
| Auth to API | Signed short-lived token or mTLS/client-credentials equivalent verified server-side |
| Capabilities | Explicit allowlisted operations per job type (e.g. `jazzhr.sync.page`, `gmail.scan.incremental`) |
| Audit | Every material action records: automation identity, initiating schedule or human actor, permitted capability, `job_run_id` / Trigger run ID, correlation ID |
| Secrets in Trigger.dev | `TRIGGER_*` + automation client credentials only — **not** service-role by default |
| Impersonation | Forbidden for scheduled jobs |

### Payload minimization

Job payloads ordinarily contain **record IDs**, idempotency keys, and non-sensitive control metadata — not résumé text, email bodies, compensation values, medical/benefits details, or identity-document numbers. Sensitive fields are loaded inside domain services after re-authorization.

---

## Alternative patterns (later optimization only)

| Pattern | Description | Status |
| --- | --- | --- |
| **A. Scoped RPC / Edge functions** | Narrow Postgres RPCs for high-volume hot paths | Deferred until justified by volume/latency |
| **B. Restricted DB role** | Dedicated Postgres role with table/column grants | Deferred alternative |
| **C. App-mediated API** | Signed automation identity → internal domain API | **Selected default** |
| **D. Service role** | Full RLS bypass | **Exception only** — documented, time-boxed, never default for workers or highly restricted reads |

`SUPABASE_SERVICE_ROLE_KEY` may exist for admin/migration/emergency tooling on the application server. It is **exception-only**, never exposed to the browser, and never issued to routine Trigger.dev workers.

---

## Trigger.dev data-handling obligations

Before enabling production jobs, Daniel (or AITHERAS security owner) must confirm:

| Topic | Requirement | Official references |
| --- | --- | --- |
| DPA | Review and accept Trigger.dev DPA / ToS processing terms | [DPA](https://trigger.dev/legal/dpa), [Security](https://trigger.dev/security) |
| Subprocessors | Review active subprocessors list | Linked from Trigger.dev Security page |
| Encryption | At-rest AES-256 and TLS in transit (vendor claim) | [Security](https://trigger.dev/security) |
| Log retention | Plan-dependent (e.g. Free 1d / Hobby 7d / Pro 30d per vendor limits docs); choose plan so retention matches policy | [Limits — log retention](https://trigger.dev/docs/limits) |
| Deletion | Document offboarding / project deletion and data-deletion request path | DPA + Security portal |
| Payload minimization | IDs-first payloads; avoid Confidential/Highly restricted content in Trigger payloads or dashboard-visible outputs | This document |
| Secrets | Trigger.dev project secrets for worker + automation credentials; never in git | Trigger.dev env/secrets docs |

HIPAA/BAA: only relevant if PHI is processed; default HRIS design keeps medical/benefits AI and broad PHI out of workers unless separately approved.

---

## Acceptance checks (before production worker)

- [ ] Worker cannot read highly restricted rows merely by possessing a general service-role key  
- [ ] Trigger.dev worker env does **not** include `SUPABASE_SERVICE_ROLE_KEY`  
- [ ] Sample JazzHR/Gmail job payload contains IDs only  
- [ ] Failed-job logs in Trigger.dev dashboard show no résumé/email body  
- [ ] `job_runs` / audit events record automation identity, initiator, capability, and job ID  
- [ ] Scheduled jobs do not authenticate as Daniel  
- [ ] Revoking automation credentials disables jobs without breaking the Vercel UI deploy  
