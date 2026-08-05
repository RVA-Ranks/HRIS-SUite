# Worker authorization boundary (Trigger.dev + Supabase)

**Status:** Phase 0A security design — required before production worker credentials  
**Related:** `QUEUE_DECISION_MEMO.md`

---

## Principles

1. Job **payloads** ordinarily contain **record IDs**, idempotency keys, and non-sensitive control metadata — not résumé text, email bodies, compensation values, medical/benefits details, or identity-document numbers.
2. Workers load sensitive fields **inside** authorized domain services after re-checking permissions and data classification.
3. A broadly available Supabase **service-role** key must **not** be the default worker pattern. Service role bypasses RLS and is too powerful for routine sync jobs.
4. Prefer one of these patterns (Daniel approves the chosen option before Phase 1 job wiring):

| Pattern | Description | When |
| --- | --- | --- |
| **A. Scoped RPC / Edge functions** | Worker authenticates as a dedicated `worker` principal and calls narrow Postgres RPCs or Edge Functions that enforce allowlisted operations | Preferred default |
| **B. Restricted DB role** | Dedicated Postgres role with table/column grants for job-needed rows only; no bypass of highly restricted tables | Acceptable |
| **C. App-mediated fetch** | Worker calls the HRIS internal API with a signed worker JWT; API enforces authz identical to UI services | Acceptable; good for parity |
| **D. Service role** | Full bypass of RLS | **Exception only**, documented, time-boxed, never for highly restricted reads by default |

5. Highly restricted records (compensation, medical/benefits, ER, identity docs) require explicit use-case approval before any worker path can read them.
6. Worker logs must not print sensitive payloads. Log IDs, status, duration, and non-sensitive error codes.

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
| Payload minimization | IDs-first payloads; avoid placing Confidential/Highly restricted content in Trigger payloads or dashboard-visible outputs | This document |
| Secrets | Trigger.dev project secrets for worker credentials; never in git | Trigger.dev env/secrets docs |

HIPAA/BAA: only relevant if PHI is processed; default HRIS design keeps medical/benefits AI and broad PHI out of workers unless separately approved.

---

## Acceptance checks (before production worker)

- [ ] Worker cannot read highly restricted rows merely by possessing a general service-role key  
- [ ] Sample JazzHR/Gmail job payload contains IDs only  
- [ ] Failed-job logs in Trigger.dev dashboard show no résumé/email body  
- [ ] `job_runs` table records state without duplicating sensitive content  
- [ ] Revoking worker credentials disables jobs without breaking the Vercel UI deploy  
