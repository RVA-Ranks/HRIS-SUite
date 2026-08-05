# Phase 0 Decision Register

**Last updated:** August 5, 2026  
**Rule:** Every unknown stays explicitly unknown. No guessing.

| ID | Decision | Owner | Evidence | Recommendation | Blocker? | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | Repository posture | Daniel / Carl | Workspace contains only roadmap + Phase 0 docs; `git init` created empty repo on `master` | Treat as **greenfield**. Do not hunt for in-repo HRIS code. | No | Proceed with clean scaffold in Phase 1 after Phase 0 gate |
| D02 | Existing systems role | Daniel | Reviews/comp are GAS + Sheets; not in this repo | **Reference implementations only** — inventory and link; do not migrate in Phase 0–1 | No | Daniel supplies Drive/Script access for inventory |
| D03 | App hosting | Daniel | Roadmap rev 1.2 + decision response | **Next.js + TypeScript on Vercel** | No | Create Vercel project when Phase 1 starts |
| D04 | Database | Daniel | Decision response | **PostgreSQL via Supabase** | No | Create Supabase project (dev) before Phase 1 coding |
| D05 | Auth | Daniel | Decision response | **Supabase Auth + Google OAuth + AITHERAS email allowlist** | Partial | Daniel: confirm Google Workspace OAuth client / admin consent path |
| D06 | Durable jobs | Carl → Daniel | `QUEUE_DECISION_MEMO.md` | **Trigger.dev** (alt: Inngest with step constraints) | Yes — needs approval | Daniel approve Trigger.dev or Inngest |
| D07 | Audience Phases 1–9 | Daniel | Decision response | **Daniel-only** operating scope; RBAC still built; second non-prod test account for permission tests | No | Identify/create second Google test account |
| D08 | JazzHR API access | Daniel | Unconfirmed | Prove API key/plan + résumé bytes or select fallback | **Yes — hard gate** | Daniel: Integrations → API key; Carl runs isolated read-only spike |
| D09 | JazzHR résumé fallback | Daniel | Not selectable until D08 fails or succeeds | Prefer API bytes → else ZIP / email attachment / export webhook / link-only | Yes until D08 | After spike, Daniel picks one fallback if needed |
| D10 | OpenAI org/project/billing | Daniel | Not provisioned | Design matrix only in Phase 0; **no live OpenAI calls** | Soft for Phase 1 shell | Provision org/project before any AI use-case enablement |
| D11 | AI data retention | Daniel | Roadmap default | Sensitive Responses API: `store: false`; redaction matrix required | Soft | Daniel approves AI data-use matrix before Phase 3+ AI flags |
| D12 | MCP hosting architecture | Carl → Daniel | OpenAI Secure MCP Tunnel + private server pattern | Private MCP process + **Secure MCP Tunnel** (outbound-only) to ChatGPT/Codex; not Vercel-as-MCP-host | Soft for Phase 1 | Approve hosting shape now; implement in Phase 9 |
| D13 | Codex SDK for engineering | Carl | Stretch | **Defer** until repo + CI + tests exist | No | Revisit after Phase 1 CI is green |
| D14 | Compliance register location | Daniel | 108-item register exists; path unknown | Authoritative Drive/Sheet path must be supplied | Yes for Phase 6 import design | Daniel provides link + owner |
| D15 | Performance Review integration path | Daniel / Carl | GAS: `Code.gs`, `V31_Automation.gs`, `Index.html`; Auto/Manual tabs; Gmail/Calendar/Sign/Form | Link-first; document deep-link/status-read after access | Soft | Grant Apps Script / Sheet read access for inventory |
| D16 | Compensation integration path | Daniel / Carl | Separate GAS/Sheet + Docs + Drive + Gmail + Sign | Link-first until deep-link/status-read verified | Soft | Grant access for inventory |
| D17 | Google Drive folders in scope | Daniel | Unknown | Approved folder list required for Drive spike | Yes for Drive proof | Daniel lists HR/recruiting folders |
| D18 | Gmail scan scope | Daniel | Unknown | Approved senders/labels/queries for nightly scan | Soft for Phase 1; hard for Phase 5 | Daniel drafts initial allowlist |
| D19 | Email send policy | Daniel | Roadmap default | Draft + explicit final send; optional “Gmail draft only” first | Soft | Confirm whether Phase 5 starts draft-only |
| D20 | Calendar publish policy | Daniel | Roadmap default | Read-only first; optional dedicated HRIS calendar later | Soft | Confirm dedicated calendar creation allowed |
| D21 | Adobe Sign API | Daniel | License unknown | Stretch spike only | Soft | Confirm Sign API entitlement |
| D22 | Evaluation datasets | Daniel | Decision response | Schema + collection process in Phase 0; do **not** block manual MVP | No for Phase 1–2 | Daniel labels examples before grading/email AI |
| D23 | Document / résumé storage | Daniel | Unknown | Prefer Drive references; controlled app storage only when required | Soft | Decide after JazzHR résumé path known |
| D24 | Data retention | Daniel | Unknown | Propose defaults; Daniel must approve | Soft | Approve retention proposal in Phase 0 package |
| D25 | Phase 0 time-box | Daniel | Decision response | Minimum gate vs stretch split | No | Execute min gate; stretch marked optional |

---

## Blocker summary (must clear before claiming Phase 0 complete)

1. **D08** — JazzHR API + résumé capability proof (or approved fallback).
2. **D06** — Queue product approval (Trigger.dev vs Inngest).
3. **D14 / D17** — Compliance register location + Drive folder allowlist (for inventory completeness; Phase 1 shell can start without them if Daniel accepts deferred inventory).
4. **D05** — Google OAuth / Workspace admin path confirmed for Supabase Auth.

**Explicitly not required to finish Phase 0 minimum gate:** live OpenAI calls, Adobe Sign live proof, Codex SDK decision beyond “defer,” full journey prose for all 11 flows, handbook export prototype.

---

## Decision response already locked (2026-08-05)

See Daniel’s Phase 0 decision response in chat and Revision 1.3 of the master roadmap: greenfield; locked stack; JazzHR hard gate; no live OpenAI in Phase 0; Daniel-only; Phase 0 split; MCP hosting early; evals as Daniel input; existing systems are references not migration targets.
