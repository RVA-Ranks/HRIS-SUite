# Phase 2 start report — Command Center + Shared Open Item Tracker

**Status:** Start report approved (PR #5). Slice A authorized under `docs/phase-2/SLICE_A_ACCEPTANCE.md`.  
**Branch:** `phase-2/command-center-mvp` (from updated `main`, not `83a6935`).  
**Governing kickoff:** `docs/phase-2/PHASE_2_KICKOFF.md`.  
**Timezone:** `America/New_York`.  
**Data rule:** fabricated records and attachments only. No production staff access. No real HR documents.  
**Invariant:** Enable default-deny RLS in the **same** migration that creates each operational table.

---

## 1. Entry-gate evidence

| Gate | Evidence |
| --- | --- |
| Dependency security hotfix | PR #4 merged → `main` includes Next.js `16.4.6`, Zod `4.6.7`, webpack build, production `npm audit --omit=dev --audit-level=high` clean, full-tree `--audit-level=critical` required |
| Exclusive OAuth roles | Migration `20261117120000_phase1_oauth_role_isolation.sql` + `resolveBootstrapRole` + trusted email maps |
| Disabled-account fail-closed | Bootstrap refuses non-`active` status; callback signs out → `/denied?reason=disabled` |
| Docs CI includes Phase 2 | Phase 0 + Phase 1 workflows glob `docs/phase-2/**/*.md` |
| Kickoff + D07/D23 | PR #3 merged; fabricated staging storage + restricted roles documented |

Remaining note: full-tree `npm audit --audit-level=high` still reports unfixed transitive **picomatch** ReDoS (`GHSA-fc5q-39xc-vjpf`, no upstream release). CI does **not** skip audit; production high + full critical remain required.

---

## 2. Exact migration filenames (planned)

Additive only; apply after Phase 1 migrations including role-isolation.

1. `supabase/migrations/20261118000000_phase2_core_entities.sql` — orgs/clients/projects/positions/requirements/tasks/deadlines/notes/entity_links/approvals/activity/notifications + enums/FKs/indexes  
2. `supabase/migrations/20261118010000_phase2_open_items_comments_attachments.sql` — task comments, documents/attachments metadata, idempotency keys, open-item source/status checks  
3. `supabase/migrations/20261118020000_phase2_permissions_rls.sql` — Phase 2 permission keys, role grants for `staff_submitter` / `hr_reviewer` / admin, RLS policies  
4. ~~`supabase/migrations/20261118030000_phase2_storage_bucket.sql`~~ — **Slice C only** (not Slice A)

Slice A keeps filenames 000000 / 010000 / 020000 stable per acceptance contract.

---

## 3. Roles and permission matrix

| Role | Bootstrap source | Grants (Phase 2 delta) | Denied |
| --- | --- | --- | --- |
| `administrator` | `AUTH_ADMIN_EMAILS` | Existing Phase 1 + positions/tasks/approvals manage | Secrets in UI; silent classification bypass |
| `staff_submitter` | `AUTH_STAFF_SUBMITTER_EMAILS` | `app.access`, `tasks.create_own`, `tasks.read_own`, `tasks.comment_own`, `documents.upload_own`, `documents.read_permitted` (own) | `audit.read`, `jobs.read`, settings, other users’ items, reviewer-only notes |
| `hr_reviewer` | `AUTH_HR_REVIEWER_EMAILS` | `app.access`, queue/assigned task read+triage, `tasks.assign` (scoped), `approvals.review` (scoped), reviewer-only notes | Org-wide admin, compensation, unrelated submissions |
| `read_only` | default allowlisted non-mapped | Phase 1 view set only | Submissions, attachments, mutations, implied staff rights |
| inactive / anonymous | — | none | everything protected |

**Invariant:** exactly one exclusive baseline role (`administrator` | `read_only` | `staff_submitter` | `hr_reviewer`). Never stack `read_only` with staff/reviewer.

---

## 4. Task / open-item transition matrix

Shared service: `transitionTask(taskId, toStatus, { reason?, note?, expectedUpdatedAt })`.

| From | Allowed next | Actor |
| --- | --- | --- |
| `new` | `triaged`, `cancelled` | reviewer/admin |
| `triaged` | `in_progress`, `waiting_on_submitter`, `cancelled` | reviewer/admin |
| `in_progress` | `waiting_on_submitter`, `resolved`, `cancelled` | reviewer/admin |
| `waiting_on_submitter` | `in_progress`, `resolved`, `cancelled` | reviewer/admin (submitter comments only) |
| `resolved` | `in_progress`, `archived` | reviewer/admin |
| `cancelled` | `triaged`, `archived` | admin (+ reason) |
| `archived` | `triaged` | admin (audited) |

Unsupported transitions → typed error, no partial write. Cancellation requires reason; resolution requires completion note; optimistic concurrency on `updated_at`.

### Approval transitions (no side effects in Phase 2)

`draft → awaiting_approval → approved|rejected → executing → completed|failed|cancelled`  
Authorized actor + reviewer note + audit. No email/calendar/ATS/AI execution.

---

## 5. Attachment storage / finalization design

| Item | Decision |
| --- | --- |
| Staging bucket | Private Supabase Storage `open-item-attachments-staging` |
| AuthZ | Domain service checks before signed URL; short TTL; no public list/read |
| Adapter | `DocumentStorage` interface so production can swap to enterprise store later |
| Lifecycle | `pending_upload → validated → linked` (DB is source of truth for “attached”) |
| Failure | Expire/compensate orphans; manual reconciliation path (workers deferred) |
| Types / size | PDF, DOCX, XLSX, PNG, JPEG; max 10 MB (configurable) |
| Production | Blocked until separate malware/retention/revocation approval |

Postgres transactions cover task + metadata + activity + idempotency. Object storage is **not** in that transaction.

---

## 6. Module map (initial PR slices)

| Slice | Deliverable |
| --- | --- |
| A | Migrations 1–3 + RLS negative tests |
| B | Task/open-item services + authorization + unit tests |
| C | Documents service + pending upload workflow + storage policies |
| D | Staff My Submissions + New Open Item UI |
| E | Reviewer Open Items triage/detail |
| F | Positions + ordinary tasks + dashboard counts |
| G | Approval Center state machine (no external execute) |
| H | Playwright critical journey + phase completion notes |

---

## 7. Test plan

- Unit: validation, transitions, `resolveBootstrapRole`, permission helpers  
- DB: cross-user RLS/storage denial; staff lacks `audit.read`/`jobs.read`; inactive bootstrap denial  
- API/service: idempotent submit; upload failure leaves no accessible attachment  
- E2E: admin position → staff submit (fabricated PDF) → assign/comment/resolve → dashboard counts  
- CI: existing Phase 0/1 suites + new Phase 2 tests; markdown links include `docs/phase-2/**`  
- Manual staging: admin, submitter, reviewer, unauthorized — fabricated only  

---

## 8. Deployment / rollback assumptions

- Separate Supabase **dev/staging** project; never production HR credentials in this phase  
- Feature flags remain off for AI/workers/external sends  
- Rollback: revert feature PRs; disable staff email maps; drop/disable staging bucket policies; migrations remain forward-only with compensating follow-ups if needed  
- Repo stays **intentionally public**; no secrets/PII in git  

---

## 9. Explicit non-goals (Phase 2)

JazzHR/Gmail/Calendar sync or sends, OpenAI live calls, Trigger.dev workers, ATS writes, production staff rollout, genuine HR file uploads.

---

**Ask of Daniel / Code Coach:** Confirm this start report. On approval, Carl begins Slice A (schema + RLS + negative tests) on `phase-2/command-center-mvp` in small reviewable PRs.
