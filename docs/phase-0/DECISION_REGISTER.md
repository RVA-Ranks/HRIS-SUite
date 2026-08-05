# Phase 0 Decision Register

**Last updated:** August 5, 2026  
**Rule:** Every unknown stays explicitly unknown. No guessing.  
**Tracks:** **0A** = architecture/security (blocks Phase 1 shell). **0B** = live integration proofs (do not block Phase 1 shell).

| ID | Track | Decision | Owner | Evidence | Recommendation | Blocker? | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D00 | 0A | Repository visibility | Daniel / Carl | Must stay private; ChatGPT/Codex app needs explicit access | Keep **Private**; do not reopen publicly for connector access | **Yes for app code** | Confirm private; grant connector access without making public |
| D01 | 0A | Repository posture | Daniel / Carl | Greenfield; baseline `e80292f` on `main` | Treat as **greenfield**. Feature branches + PRs for future work | No | Continue docs/PRs; no direct-to-main app commits |
| D02 | 0A | Existing systems role | Daniel | Reviews/comp are GAS + Sheets | **Reference implementations only** | No | Daniel supplies Drive/Script access for 0B inventory |
| D03 | 0A | App hosting | Daniel | Locked | **Next.js + TypeScript on Vercel** | No | Create Vercel project only after private repo + 0A |
| D04 | 0A | Database | Daniel | Locked | **PostgreSQL via Supabase** | No | Create Supabase **dev** after 0A |
| D05 | 0A/0B | Auth | Daniel | Locked design; live proof 0B | **Supabase Auth + Google OAuth + allowlist** | Soft for shell design; 0B for live login | Confirm Workspace OAuth path |
| D06 | 0A | Durable jobs | Carl → Daniel | `QUEUE_DECISION_MEMO.md` + official vendor docs | **Trigger.dev** + `WORKER_AUTHORIZATION.md` | Yes — needs 0A approval | Approve Trigger.dev + worker pattern |
| D07 | 0A | Audience Phases 1–9 | Daniel | Locked | Daniel-only; RBAC + second test account | No | Identify test account |
| D08 | 0B | JazzHR API + résumés | Daniel | Unconfirmed | Prove API/résumé bytes or select fallback | **Yes for matching**; **No for Phase 1 shell** | Isolated read-only spike |
| D09 | 0B | JazzHR résumé fallback | Daniel | After D08 | Prefer API bytes → else ZIP / email / webhook / link-only | After D08 | Daniel picks if needed |
| D10 | 0A | OpenAI org/project | Daniel | Not provisioned | Design matrix only; no live calls in Phase 0 | Soft for Phase 1 shell | Provision before AI flags |
| D11 | 0A | AI retention | Daniel | Roadmap default | `store: false` for sensitive; matrix required | Soft | Approve AI data-use matrix |
| D12 | 0A | MCP hosting | Carl → Daniel | Secure MCP Tunnel + private process | Private MCP + OpenAI Secure MCP Tunnel; not Vercel-as-MCP-host | Soft for Phase 1 | Approve shape; implement Phase 9 |
| D13 | 0A | Codex SDK | Carl | Stretch | **Defer** until CI/tests exist | No | Revisit after Phase 1 CI |
| D14 | 0B | Compliance register | Daniel | Path unknown | Supply authoritative Drive/Sheet link | Yes for Phase 6 import | Daniel provides link |
| D15 | 0B | Performance Review path | Daniel / Carl | GAS artifacts known | Link-first after access | Soft | Grant Script/Sheet access |
| D16 | 0B | Compensation path | Daniel / Carl | GAS/Sheet/Docs/Sign | Link-first; highly restricted | Soft | Grant access |
| D17 | 0B | Drive folders | Daniel | Unknown | App allowlist + server-side file validation; scopes ≠ folders | Yes for Drive proof | Daniel lists folder IDs |
| D18 | 0B | Gmail scan scope | Daniel | Unknown | Approved senders/labels | Soft for Phase 1; hard for Phase 5 | Draft allowlist |
| D19 | 0A | Email send policy | Daniel | Roadmap default | Draft + explicit send | Soft | Confirm Phase 5 draft-only start |
| D20 | 0A | Calendar publish | Daniel | Roadmap default | Read-only first | Soft | Confirm dedicated calendar |
| D21 | 0B | Adobe Sign API | Daniel | Unknown | Stretch spike | Soft | Confirm entitlement |
| D22 | 0A | Evaluation datasets | Daniel | Locked | Schema now; labels before grading/email AI | No for Phase 1–2 | Label before AI enablement |
| D23 | 0A/0B | Document storage | Daniel | Unknown | Drive references preferred | Soft | Decide after JazzHR path |
| D24 | 0A | Data retention | Daniel | Proposal in report | Daniel must approve | Soft | Approve or edit proposal |
| D25 | 0A | Phase 0 split | Daniel / Code Coach | Review | **0A vs 0B**; Phase 1 after 0A | No | Approve 0A package |
| D26 | 0A | Worker ↔ Supabase | Carl → Daniel | `WORKER_AUTHORIZATION.md` | **Pattern C selected**: signed automation identity → internal domain API; no service-role for routine workers; A/B later optimizations | Soft — provisional 0A approve | Confirm Pattern C; audit fields include automation identity + job ID |

---

## Blocker summary

**Before application code:** D00 (private repo) + Phase 0A approvals (especially D06, D26, classification).

**Before candidate matching:** D08 (and D09 if needed).

**Not required to start Phase 1 shell:** JazzHR résumé proof, Adobe Sign live proof, full journey writeups, OpenAI live calls.

---

## Related

- `PHASE_0_REPORT.md`
- `QUEUE_DECISION_MEMO.md`
- `WORKER_AUTHORIZATION.md`
- `ACCESS_MATRIX.md`
- `README.md` / `AGENTS.md`
