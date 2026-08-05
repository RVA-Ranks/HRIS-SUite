# AGENTS.md — Rules for Carl and other coding agents

This file binds AI agents working in **RVA-Ranks/HRIS-SUite**. Human authority remains with Daniel; technical review with Code Coach.

---

## Governing contract

1. Treat `DANIEL_HRIS_MASTER_IMPLEMENTATION_ROADMAP_FOR_CARL.md` as the authoritative build contract.
2. Treat `docs/phase-0/DECISION_REGISTER.md` and Daniel’s written decision responses as binding clarifications.
3. Prefer the smallest coherent change for the active phase. Do not implement future-phase features “because they are nearby.”
4. Existing Performance Review / Compensation / Apps Script systems are **reference implementations**, not migration targets, unless Daniel commissions a separate migration project.

---

## Phase gates

| Gate | Meaning |
| --- | --- |
| **Phase 0A** | Architecture & security decisions approved |
| **Phase 0B** | Live integration proofs (JazzHR, Google, Drive, etc.) — can stay open |
| **Phase 1** | Secure shell allowed **after Phase 0A** (and private repo), even if 0B is incomplete |
| Later phases | Require prior phase gate + Daniel approval |

**Do not advance phases** without Daniel and Code Coach review.

JazzHR résumé retrieval is a hard gate for **candidate matching**, not for Next.js scaffolding, auth, RBAC, audit, shell, feature flags, or CI.

---

## Hard security rules

- **No production HR data** in source, logs committed to git, tests, fixtures, screenshots in PRs, or seed files.
- Use **fabricated** fixtures only.
- Secrets exist only as **server-side environment variables** (and approved secret managers). Never in client bundles, commits, or agent transcripts that get pasted into issues.
- Do not add application code until the GitHub repository is **private** (Daniel action).
- No direct external sends (email, calendar publish, ATS writes, handbook distribution) without explicit human approval flows.
- No AI-enabled material actions without Approval Center / explicit confirmation patterns from the roadmap.
- OpenAI calls only through the central AI Gateway once provisioned; never direct SDK use from UI or ad hoc routes.
- MCP tools must call domain services with the same authorization as the UI; never bypass Approval Center.

---

## Git workflow

1. Default branch is `main`.
2. All substantive work uses a **feature branch** and a **pull request**.
3. Do not commit Phase 1+ application code directly to `main`.
4. After pushing, notify Daniel with: **“Carl pushed changes.”** Reviewers compare new commits against the agreed baseline.
5. Never force-push `main`. Never commit secrets. Never amend shared history unless explicitly instructed under the project’s amend rules.
6. Do not update git `user.name` / `user.email` config.

Suggested commit style: conventional, concise, why-focused  
Example: `docs(phase-0): harden repository security and split integration gates`

---

## Required checks (as they exist)

Before claiming a delivery complete:

- [ ] Lint / markdown checks (docs workflows)
- [ ] Secret scanning workflow green
- [ ] Typecheck, lint, unit tests, build — **once** Next.js scaffold exists
- [ ] No real PII/HR data in the diff
- [ ] Roadmap / decision register updated if decisions changed

---

## Definition of done (every Carl delivery)

1. Stated scope matches the approved phase slice  
2. Conflicts with roadmap called out explicitly (never silently overwritten)  
3. Automated checks run; failures fixed or disclosed  
4. Manual acceptance notes for Daniel when UI/behavior changes  
5. Rollback / feature-flag disable path when risk warrants it  
6. Phase completion package when asserting a phase gate  

---

## Communication

- Prefer links to commits/PRs over dumping file contents into chat once the GitHub workflow is active.
- Keep unknowns explicit in the decision register — **no guessing**.
- When blocked on credentials, document the blocker and continue non-blocked workstreams (e.g., Phase 1 shell after 0A while 0B continues).
