# Phase 0 Report — Daniel's HR Command Center

**Document status:** Minimum-gate draft for Daniel approval  
**Author:** Carl (Cursor AI)  
**Date:** August 5, 2026  
**Timezone:** America/New_York  
**Authority:** Master roadmap + Daniel Phase 0 decision response (2026-08-05)

---

## 0. Executive verdict

This repository is **greenfield**. There is no existing Next.js/HRIS codebase to integrate. Existing Performance Review, Compensation, compliance, and related workflows live outside this repo as Google Workspace / Apps Script / Adobe Sign systems and must be treated as **reference implementations**, not migration targets.

Phase 0 **minimum gate is not yet closed**. Several proofs require Daniel-supplied access (JazzHR, Google OAuth/Drive, compliance register location). Architecture, stack, security design, queue recommendation, MCP hosting recommendation, and Phase 1 vertical-slice specification are documented below so Phase 1 can start cleanly once blockers clear.

**Proceed-to-Phase-1 recommendation:** **Not yet.** Approve open decisions, clear JazzHR hard gate (or fallback), confirm OAuth path, then start Phase 1 shell.

---

## 1. Current-state architecture

| Item | Finding |
| --- | --- |
| Repository contents | `DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md` + `docs/phase-0/*` |
| Framework / app code | None |
| Package manager | N/A |
| Database / migrations | None |
| Auth | None |
| CI/CD | None |
| Vercel project | Not connected |
| Tests | None |
| Git | Initialized empty repo on `master` (no commits at report time) |
| Secrets in repo | None observed |

**Implication:** Phase 1 creates the application from a clean scaffold. Do not “preserve” nonexistent modules.

---

## 2. Existing-system inventory (external)

Inventoried from Daniel’s decision response. Live access still required to deepen capability matrices.

### 2.1 Performance Review system

| Field | Value |
| --- | --- |
| Type | Google Apps Script + Google Sheets |
| Known artifacts | `Code.gs`, `V31_Automation.gs`, `Index.html` |
| Workflow tabs | `Auto Performance Reviews`, `Manual Performance Reviews` |
| Integrations used | Gmail, Google Calendar, Adobe Sign, Google Form (self-evaluation) |
| System of record | Existing Sheet/Script workflow until a separately approved migration |
| Command Center posture | **Link-first**; deep-link/status-read after access verified |
| Phase 0 action | Inventory via approved access; do not copy or rewrite |

### 2.2 Compensation Adjustment system

| Field | Value |
| --- | --- |
| Type | Separate GAS + Sheet–backed workflow |
| Artifacts | Google Docs templates, restricted Drive records, Gmail notifications, Adobe Sign |
| System of record | Existing workflow |
| Command Center posture | **Link-first** until deep-link/status-read verified |
| Phase 0 action | Inventory only; highly restricted data handling |

### 2.3 Compliance register

| Field | Value |
| --- | --- |
| Content | Approved 108-item register |
| Authoritative location | **Unknown — blocker for import design** |
| Command Center posture | Import later (Phase 6) with source-row traceability |

### 2.4 Other Google / Adobe workflows

| System | Status |
| --- | --- |
| Gmail / Calendar / Drive | Required integration proofs; access pending |
| JazzHR | API access **unconfirmed** — hard gate |
| Adobe Acrobat Sign | Stretch spike; license/API entitlement unknown |
| ADP | Out of write scope; link/summarize only later |

**Product rule:** These systems are valuable references. Phase 1 builds a clean Daniel-only shell with manual intake and linked records. Automation is earned after integrations are proven.

---

## 3. Locked target architecture

Unless Phase 0 finds a concrete incompatibility (none found so far):

```text
┌─────────────────────────────────────────────────────────────┐
│  Vercel — Next.js (UI, auth’d API, short webhooks, cron     │
│           enqueue only)                                     │
└─────────────┬───────────────────────────────┬───────────────┘
              │                               │
              ▼                               ▼
     ┌────────────────┐              ┌────────────────────┐
     │ Supabase       │              │ Trigger.dev        │
     │ Postgres +     │◄─────────────│ durable jobs       │
     │ Auth (Google)  │              │ (recommended)      │
     └────────────────┘              └────────────────────┘
              ▲
              │ domain services only
     ┌────────┴────────┐     ┌──────────────────────────────┐
     │ AI Gateway      │     │ Private MCP (Phase 9)        │
     │ (disabled until │     │ + OpenAI Secure MCP Tunnel   │
     │  use-case flags)│     │ (design now; implement later)│
     └─────────────────┘     └──────────────────────────────┘
```

### 3.1 Stack table

| Layer | Choice |
| --- | --- |
| App | Next.js + TypeScript |
| Hosting | Vercel (preview / staging / production) |
| DB | PostgreSQL via Supabase |
| Auth | Supabase Auth + Google OAuth + AITHERAS allowlist |
| Jobs | **Trigger.dev recommended** (see `QUEUE_DECISION_MEMO.md`) |
| AI | Central AI Gateway (Responses API); **no live calls in Phase 0** |
| MCP | Private authenticated tools → same domain services; Phase 9 pilot |
| Codex SDK | Defer until CI/tests exist |

### 3.2 Code boundaries (Phase 1 scaffold target)

```text
src/
  app/                 # Next.js routes (UI + thin API)
  components/          # Design system / shell
  domains/             # Business rules (no vendor SDKs)
  integrations/        # Adapters (JazzHR, Gmail, …) — later phases
  ai/gateway/          # Disabled-by-default OpenAI boundary
  mcp/                 # Contracts only until Phase 9
  jobs/                # Trigger.dev (or Inngest) entrypoints → domains
  lib/ server/ test/
```

UI never calls external APIs directly. Jobs never bypass domain authorization.

---

## 4. Integration capability status

### 4.1 JazzHR — HARD GATE

| Capability | Proven? | Notes |
| --- | --- | --- |
| Auth / API key | **Unknown** | Account Integrations area; plan access unconfirmed |
| List jobs | Unknown | |
| List candidates + pagination | Unknown | Docs claim ≤100/page |
| Search/filter fields | Unknown | Document from live responses |
| Contact / job associations | Unknown | |
| Résumé bytes | Unknown | **Do not promise matching UX beyond metadata** until proven |
| Profile deep link | Unknown | |
| Candidate export webhook | Unknown | Fallback candidate |
| Writes | Out of initial scope unless justified | |

**Fallback options if résumé bytes unavailable** (Daniel selects one after proof):

1. Metadata + JazzHR links + approved user-triggered bulk ZIP import  
2. Candidate-notification emails with résumé attachments (if reliable)  
3. JazzHR Candidate Export webhook for forward-looking intake  
4. Preview stays in JazzHR; matching only for résumés imported via approved route  

**Do not scrape.**

### 4.2 Google OAuth / Gmail / Calendar / Drive

| Spike | Status |
| --- | --- |
| Supabase Auth Google login + allowlist | Design ready; live proof pending Daniel OAuth client / Workspace admin |
| Gmail read + draft scopes | Pending |
| Calendar read (+ test write to HRIS calendar) | Pending |
| Drive approved folders | Pending folder allowlist from Daniel |

Nightly incremental Gmail sync is the initial design; Pub/Sub push is later optimization.

### 4.3 Adobe Sign

Stretch only. Confirm API entitlement before any adapter design solidifies.

### 4.4 Review / Compensation apps

Link-first. Deep-link and status-read matrices remain **unknown** until Script/Sheet access is granted. No rewrite in Phase 0–1.

### 4.5 OpenAI

| Item | Phase 0 posture |
| --- | --- |
| Live API calls | **Forbidden** until org/project/billing provisioned |
| Gateway interface | Design only |
| `store: false` default | Required for sensitive classes |
| Kill switch / per-use-case flags | Required in Phase 1 foundation |
| Eval sets | Schema + collection process only; Daniel labels later |

---

## 5. Data classification and privacy design (proposal)

| Classification | Examples | Default handling |
| --- | --- | --- |
| Internal | Position status, general tasks | Authenticated; normal audit |
| Confidential | Résumés, email content, employee docs | Minimize copies; encrypted transport/storage; restricted access |
| Highly restricted | Compensation, medical/benefits, ER, identity docs | Separate permissions; no broad search indexing; enhanced audit; AI off until approved |
| Public/approved | Published JDs, approved handbook text | Export only after approval |

**Retention proposal (defaults — Daniel must approve):**

| Data | Default |
| --- | --- |
| Audit events | Long-lived append-only; no raw secrets |
| AI runs metadata | Keep model/prompt/schema/usage/disposition; raw prompts/outputs per use-case matrix |
| Cached résumé derivatives | Prefer Drive/ATS as authority; cache TTL + delete-on-revoke |
| Email bodies | Store minimal metadata + suggestion fields; full body only when required for audit of an approved action |
| Soft deletes | Only where recovery required; not a substitute for retention |

**Production data never enters local tests.** Fixtures are fabricated or approved anonymized samples only.

---

## 6. AI data-use matrix (design only — no credentials)

| Use case | Classification | Min fields | Redaction | `store` | Human approval | Enabled phase |
| --- | --- | --- | --- | --- | --- | --- |
| Position extraction | Confidential | Source text excerpts | Secrets/PII minimize | `false` | Required before create | 3 (flagged) |
| JD standardization | Confidential | Approved position fields | No invented compensation | `false` | Required before Approved JD | 3 |
| Sourcing queries | Internal/Confidential | Approved requirements | No universal FSP | `false` | Editable before use | 3 |
| Candidate matching | Confidential | Evidence spans + requirements | Highly restricted out | `false` | Review before disposition | 4 |
| Email task extraction | Confidential | Thread excerpts | Treat body as untrusted | `false` | Suggestion queue | 5 |
| Reply drafting | Confidential | Thread + intent | Recipients not model-chosen | `false` | Explicit send click | 5 |
| Compliance prep summary | Internal/Confidential | Obligation + checklist | Not legal determination | `false` | Review | 6 |
| Compensation drafting | Highly restricted | **Disabled** until approved | N/A | N/A | N/A | Blocked |
| Handbook comparison | Internal | Section diffs + approved blocks | No employee PII | `false` | Accept before edit | 8 |
| Weekly narrative | Internal | Aggregated counts | No restricted snippets | `false` | Edit before export | 9 |
| NL → structured search | Internal | Query text | Permissioned plans only | `false` | Results still ACL’d | 9 |

---

## 7. Private MCP hosting recommendation (early architecture)

**Implement/pilot in Phase 9; decide hosting shape now.**

### Recommended shape

1. **MCP server** = small Node/TypeScript process that exposes typed tools and calls the **same authorized domain services** as the web app (no direct DB with elevated bypass).  
2. **Reachability to ChatGPT/Codex** = prefer **OpenAI Secure MCP Tunnel** (`tunnel-client`, outbound-only HTTPS) so the MCP host need not be publicly ingress-exposed.  
3. **Runtime host for the MCP process** = small always-on or supervised host (e.g., Fly.io / Railway / small VM) **or** colocated with a private worker environment—not a Vercel serverless route as the primary long-term MCP host.  
4. **AuthZ** = map MCP caller → HRIS user/role; per-tool permissions; field filtering; rate limits; audit `tool_invocations`; kill switches for client/tool/tier.  
5. **Tiers** = Read → Draft → Action(create Approval Center request only).

### Explicit non-goals for Phase 0–1

- No production MCP tools  
- No production HR data through MCP  
- No Codex SDK as HR workflow engine  

---

## 8. Authorization matrix (initial)

| Role | Phase 1–9 exposure | Notes |
| --- | --- | --- |
| Administrator | Daniel’s AITHERAS account(s) | Full operational access |
| HR Admin / Manager / Executive Approver / Read-Only | Schema only | Not exposed until separate acceptance |
| Test non-admin | Second non-production Google account | Used to prove deny paths before multi-user |

Server enforces every permission. UI checks are convenience only.

Compensation and ER fields require narrower permissions than general employee data even while only Administrator is exposed.

---

## 9. OAuth scope list (proposed minimum)

Confirm exact scopes during live Google spike:

| Integration | Initial scopes (direction) |
| --- | --- |
| Login | OpenID / email / profile via Supabase Google provider |
| Gmail read | `gmail.readonly` (or narrower if viable) |
| Gmail draft | `gmail.compose` when drafts enabled |
| Gmail send | Separate later consent; not bundled early |
| Calendar read | `calendar.readonly` |
| Calendar write | Only when publishing to dedicated HRIS calendar |
| Drive | Per-folder least privilege; avoid blanket Drive access |

Workspace admin verification/consent may be required for internal app use—confirm with Daniel.

---

## 10. Scheduled-job design (with recommended runner)

| Concern | Design |
| --- | --- |
| Enqueue | Vercel Cron → Trigger.dev event/task (or admin “Run now”) |
| Execute | Trigger.dev worker |
| Persistence | `job_runs` + `sync_runs` in Supabase |
| Idempotency | Deterministic keys (e.g., `gmail:{messageId}:{extractVersion}`) |
| Failure | Attempt count, next retry, dead-letter, admin freshness banner |
| Replay | Safe replay must not duplicate sends or ATS writes |

---

## 11. Environments

| Env | Data | Secrets | Purpose |
| --- | --- | --- | --- |
| Local | Fabricated seed | Local env files (gitignored) | Dev |
| Preview | Fabricated | Vercel preview envs | PR checks |
| Staging | Fabricated only | Separate Supabase + OAuth callbacks | Integration proofs |
| Production | Real HR data | Separate project | Daniel-only after gates |

Rollback: Vercel deployment rollback + additive migrations; destructive migrations require separate plan.

---

## 12. Initial entity model (Phase 1–2 core)

Phase 1 foundation tables:

`users`, `roles`, `permissions`, `user_roles`, `integration_connections`, `sync_runs`, `job_runs`, `audit_events`, `feature_flags`, `app_settings`, `ai_runs`, `prompt_versions`, `tool_invocations`

Phase 2 operational tables:

`organizations`, `clients`, `projects`, `positions`, `position_requirements`, `tasks`, `deadlines`, `notes`, `documents` (references), `entity_links`, `approvals`, `activity_events`, `notifications`

Queryable business fields are normalized columns. JSON only for controlled raw payloads / versioned extraction blobs.

---

## 13. Evaluation dataset process (Daniel input dependency)

**Does not block Phase 1–2 manual vertical slice.**

### Schema (collection)

| Field | Purpose |
| --- | --- |
| `eval_case_id` | Stable ID |
| `use_case` | e.g., position_extract, candidate_grade, email_actionable |
| `input_fixture_ref` | Fabricated/anonymized fixture path |
| `expected_output` | Structured expected fields |
| `labels` | Daniel disposition / gold labels |
| `threshold_notes` | What “pass” means |
| `pii_class` | Classification |

### Process

1. Carl creates empty schema + folder conventions in Phase 1.  
2. Daniel supplies labeled examples before enabling automated grading or unattended email classification.  
3. Promotion requires agreed metrics (precision/recall, unsupported-claim rate, etc.).

---

## 14. Phase 1 vertical-slice specification

**Goal:** Deployable Daniel-only shell that earns trust before automation.

### In scope

1. Next.js app on Vercel with staging + production project layout  
2. Supabase schema + migrations for foundation tables  
3. Google OAuth via Supabase Auth + allowlist + Administrator role  
4. RBAC tables + server authorization helper + deny audit  
5. App shell: nav, table, filters, badges, empty/error/loading, confirmation dialog  
6. Health endpoint, structured logs, correlation IDs  
7. Audit log viewer (redacted)  
8. Integration status page (all disconnected / disabled)  
9. Job-run viewer wired to `job_runs` (runner stub or Trigger.dev once approved)  
10. AI Gateway **disabled by default** (interface + kill switch + architecture guard); **no provider calls** until credentials + matrix approval  
11. Feature flags  
12. CI: lint, typecheck, unit tests, Playwright smoke for login deny/allow  
13. Manual Command Center path continues in **Phase 2** (positions/tasks/approvals)—Phase 1 stops at secure foundation unless Daniel wants Phase 1+2 combined after gate

### Explicitly out of Phase 1

- JazzHR sync, Gmail scan, calendar write, MCP tools, handbook, reviews rewrite  
- Fake recruiting demos that pretend integrations work  

### Acceptance (from roadmap §9.2, adapted)

- Unapproved Google account denied  
- Daniel can sign in/out  
- Protected routes require session  
- Permission checks server-side  
- Separate staging/production credentials  
- AI flag off → no provider request  
- Audit events for login/logout/deny/settings  
- Rollback without destructive DB change  

---

## 15. Risk register (active)

| Risk | Status | Mitigation |
| --- | --- | --- |
| JazzHR résumé bytes unavailable | Open | Hard gate + fallback menu |
| Google Workspace OAuth admin friction | Open | Minimum scopes; internal app; staged consent |
| Trigger.dev needs DB secret exposure | Open | Prefer HTTPS Supabase API; secret scanning |
| Scope creep into rewriting GAS apps | Controlled | Reference-only rule; Phase 1 manual shell |
| OpenAI not provisioned | Controlled | Design-only; features flagged off |
| Phase 0 never finishes | Controlled | Min vs stretch split |

---

## 16. Minimum gate vs stretch checklist

### Minimum gate

| Item | Status |
| --- | --- |
| Repo confirmation (greenfield) | **Done** |
| Systems inventory (from Daniel + external posture) | **Partial** — access deepening pending |
| Credentials/access matrix | **Done as register** — many Unknown |
| JazzHR résumé proof | **Blocked** — needs Daniel |
| Google integration proof | **Blocked** — needs Daniel |
| Queue recommendation | **Done** — awaiting approval |
| Data-classification/privacy design | **Done (proposal)** — awaiting approval |
| Phase 1 vertical-slice specification | **Done** |
| Decision register | **Done** (`DECISION_REGISTER.md`) |

### Stretch (optional this round)

| Item | Status |
| --- | --- |
| Adobe Sign live-status proof | Not started |
| Codex SDK recommendation | **Defer** documented |
| Private MCP hosting recommendation | **Done (design)** |
| Full 11 journey writeups | Deferred to access-backed inventory |
| Handbook-export prototype | Not started |

---

## 17. What Carl needs from Daniel next

1. Approve **Trigger.dev** (or choose Inngest).  
2. Provide JazzHR API access for an isolated, non-committed, read-only spike.  
3. Confirm Google OAuth path for Supabase (project + Workspace constraints).  
4. Provide compliance register authoritative link and approved Drive folders.  
5. Grant read access to Performance Review and Compensation Script/Sheet projects for inventory notes.  
6. Approve classification/retention proposals (or mark edits).  
7. Identify second non-prod Google account for RBAC deny tests.  
8. When ready: provision OpenAI org/project (still no Phase 0 live calls required).

---

## 18. Recommendation

**Do not start Phase 1 coding until:**

- D06 queue choice approved  
- D08 JazzHR proof completed **or** Daniel explicitly accepts starting Phase 1 shell with JazzHR deferred (integrations remain disabled)  
- D05 OAuth path confirmed  

If Daniel prefers momentum, an allowed narrowing is: **Phase 1 shell-only** with all integrations disabled, while JazzHR/Google spikes continue in parallel as Phase 0 remnants—provided the Phase 0 report is marked “architecture approved; integration proofs outstanding.”

---

## Related files

- `docs/phase-0/DECISION_REGISTER.md`  
- `docs/phase-0/QUEUE_DECISION_MEMO.md`  
- `DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md` (Rev 1.3)
