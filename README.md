# Daniel's HR Command Center

Personal HR operating system for AITHERAS recruiting and HR workflows. This repository is the build home for the suite described in the master roadmap.

**Repository:** [RVA-Ranks/HRIS-SUite](https://github.com/RVA-Ranks/HRIS-SUite)  
**Baseline commit:** [`e80292f`](https://github.com/RVA-Ranks/HRIS-SUite/commit/e80292f40d2ce04e7733c4ee5cc8e1b0c456d10f)

---

## Current phase and gate

| Track | Status |
| --- | --- |
| **Phase 0A** — Architecture & security approval | **Technically approved** |
| **Phase 0B** — Live integration proofs (JazzHR, Google, Drive, external systems) | Open — does **not** block Phase 1 shell |
| **Phase 1** — Secure application shell | **Technically approved (97%)** on `phase-1/secure-platform-foundation` (PR #2) — awaiting one fresh CI suite on the final docs head, then merge |
| Application code | Next.js 16 scaffold with auth, RBAC, RLS, audit, shell UI, AI Gateway boundary |

**Governing rule:** Existing Performance Review, Compensation, Apps Script, and related Google/Adobe workflows are **external reference implementations**. Phase 1 builds a clean Daniel-only shell with manual intake and linked records. Automation is earned after integrations are proven.

---

## Locked stack (Phase 0A)

| Layer | Choice |
| --- | --- |
| App | Next.js + TypeScript |
| Hosting | Vercel (UI / short-lived API / cron enqueue only) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth + Google OAuth + AITHERAS allowlist |
| Durable jobs | Trigger.dev recommended (see queue memo); not Vercel as worker |
| AI | Central AI Gateway (Responses API); disabled until provisioned |
| MCP | Design hosting in 0A; implement/pilot in Phase 9 |

---

## Repository map

```text
DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md   # Build contract
AGENTS.md                                               # Rules for Carl / agents
README.md                                               # This file
.env.example                                            # Env var names only
src/                                                    # Next.js App Router application
supabase/migrations/                                    # SQL migrations
docs/phase-0/                                           # Phase 0 working package
docs/phase-1/                                           # Phase 1 start report
.github/workflows/                                      # CI checks (docs + app quality)
```

---

## Security and data-handling rules

1. **Repository visibility is intentionally public** so Code Coach can review consistently. Public source is acceptable. Carl must **not** change GitHub repository visibility.
2. **Never commit** credentials, API keys, OAuth tokens, `.env` values, employee information, résumés/CVs, production configuration, integration secrets, or other sensitive HR data. Use fabricated fixtures only. Secrets stay in server-side environment variables / secret managers.
3. **No production HR data** in source, tests, fixtures, logs committed to the repo, or PR descriptions.
4. `.gitignore` is necessary but not sufficient — treat every commit as potentially reviewable.
5. Job payloads should carry **record IDs**, not résumé text, email bodies, or compensation values, whenever possible.
6. Google Drive: OAuth scopes ≠ folder restrictions. Enforce approved folder IDs in application code and validate every file ID server-side.

---

## Local / staging / production data

| Environment | Data allowed |
| --- | --- |
| Local | Fabricated seed only |
| Preview / staging | Fabricated only |
| Production | Real HR data after go-live gates; never copied into git or local tests |

See `.env.example` for variable **names** only.

---

## Branch and PR requirements

- Default branch: `main`
- **Do not commit Phase 1+ application work directly to `main`**
- Use feature branches and pull requests
- Daniel and Code Coach review before merging phase-advancing work
- Carl should announce pushes as: “Carl pushed changes” (reviewers compare against baseline / previous commit)

---

## Definition of done for each Carl delivery

1. Scope limited to the approved phase slice  
2. Phase-start findings recorded when implementing code phases  
3. Tests / checks green (or documented gaps)  
4. No secrets or real HR data introduced  
5. Phase completion package (summary, files, migrations, env names, tests, limitations, rollback) when a phase gate is claimed  
6. Explicit recommendation to proceed or not  

---

## Development commands

```bash
npm ci
npm run dev          # local dev server
npm run lint
npm run typecheck
npm run test         # Vitest unit tests
npm run test:db      # RLS integration (requires RUN_DB_INTEGRATION=1 + local Supabase)
npm run build
npm run test:e2e     # Playwright smoke — CI builds first, then installs Chromium and runs e2e
```

Auth: set `AUTH_ALLOWLIST_EMAILS` (who may sign in) and `AUTH_ADMIN_EMAILS` (administrator bootstrap). Daniel must be on both for admin access.

CI (`.github/workflows/phase1-app.yml`): secret scan, Markdown link validation, lint, typecheck, unit tests, `npm audit`, production build, Playwright, and Supabase RLS integration (`db-rls`). Markdownlint remains deferred.

---

## Key documents

- [Master roadmap](./DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md)
- [Phase 0 report](./docs/phase-0/PHASE_0_REPORT.md)
- [Decision register](./docs/phase-0/DECISION_REGISTER.md)
- [Queue decision memo](./docs/phase-0/QUEUE_DECISION_MEMO.md)
- [Worker authorization](./docs/phase-0/WORKER_AUTHORIZATION.md)
- [Phase 1 start report](./docs/phase-1/PHASE_1_START.md)
- [Agent rules](./AGENTS.md)
