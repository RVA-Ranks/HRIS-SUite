# Daniel's HR Command Center

Personal HR operating system for AITHERAS recruiting and HR workflows. This repository is the build home for the suite described in the master roadmap.

**Repository:** [RVA-Ranks/HRIS-SUite](https://github.com/RVA-Ranks/HRIS-SUite)  
**Baseline commit:** [`e80292f`](https://github.com/RVA-Ranks/HRIS-SUite/commit/e80292f40d2ce04e7733c4ee5cc8e1b0c456d10f)

---

## Current phase and gate

| Track | Status |
| --- | --- |
| **Phase 0A** — Architecture & security approval | In progress — docs hardening / awaiting Daniel + Code Coach review |
| **Phase 0B** — Live integration proofs (JazzHR, Google, Drive, external systems) | Open — does **not** block Phase 1 shell |
| **Phase 1** — Secure application shell | **Blocked until Phase 0A approved** and repository is **private** |
| Application code | None yet (greenfield planning docs only) |

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
docs/phase-0/                                           # Phase 0 working package
  PHASE_0_REPORT.md
  DECISION_REGISTER.md
  QUEUE_DECISION_MEMO.md
  ACCESS_MATRIX.md
  EVAL_COLLECTION_SCHEMA.md
  WORKER_AUTHORIZATION.md
.github/workflows/                                      # CI checks (docs/security)
```

---

## Security and data-handling rules

1. **Make this repository private** before any application code, integration artifacts, screenshots of real data, or fixtures derived from real HR content are added.
2. **No secrets in git** — use server-side environment variables only. Never commit `.env`, API keys, OAuth tokens, or credential JSON.
3. **No production HR data** in source, tests, fixtures, logs committed to the repo, or PR descriptions. Use fabricated data only.
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

Application scaffold does not exist yet. After Phase 1 Next.js scaffolding lands, this section will list `install`, `dev`, `lint`, `typecheck`, `test`, and `build` commands.

Current docs CI: see `.github/workflows/phase0-checks.yml`.

---

## Key documents

- [Master roadmap](./DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md)
- [Phase 0 report](./docs/phase-0/PHASE_0_REPORT.md)
- [Decision register](./docs/phase-0/DECISION_REGISTER.md)
- [Queue decision memo](./docs/phase-0/QUEUE_DECISION_MEMO.md)
- [Worker authorization](./docs/phase-0/WORKER_AUTHORIZATION.md)
- [Agent rules](./AGENTS.md)
