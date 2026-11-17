# Phase 2 kickoff brief — Command Center + Shared Open Item Tracker

**Status:** Draft for Daniel / Code Coach approval; NO Phase 2 implementation until approved.  
**Parent:** `main` @ `83a6935` (PR #2 merged; Phase 0/1 CI green on `8d303e9`).  
**Future branch:** `phase-2/command-center-mvp` (create only after this kickoff is approved).  
**Timezone:** `America/New_York`.  
**Architecture:** Next.js / TypeScript / Vercel; Supabase Postgres, Auth, RLS; existing Phase 1 audit and permission boundary.  
**Repository:** intentionally public for source review. No credentials, production HR data, employee/candidate records, or genuine attachments in source, tests, screenshots, PRs, or logs.

## 1. Goal and approved-scope change to resolve

Deliver a usable **manual Command Center** covering positions, tasks, deadlines, links, approvals, and dashboard counts. Add a **Shared Open Item Tracker** within Phase 2: a back-office user can type a question, optionally upload a form, and submit it to the app as a trackable task instead of sending an email. Example workflow: Cathi asks "What is this form?" and attaches a sample document; Daniel sees a new item in the intake queue, assigns it, comments, and resolves it; Cathi sees status and responses to her own submission.

This is a scope amendment to the original Daniel-only Phase 1–9 posture and the original Phase 3 file-intake plan. **Before implementation, Daniel must approve the limited staff-submitter role and the permitted attachment storage pattern; amend the governing roadmap and Decision Register D07/D23 to document this exception.** No broad release to staff is authorized by this draft alone.

Keep it manual: no JazzHR/Gmail/Calendar sync or sends, no OpenAI execution, no Trigger.dev workers, no ATS writes, no production credentials or real HR records in staging. In-app notices are allowed; external notifications are deferred.

## 2. Functional scope

### 2.1 Manual position and task operations

- Create/view/edit/filter/close/reopen positions with client/project, title, priority, status, openings, location, clearance, deadline, requirements, and permission-controlled compensation values.
- Create/view/edit/assign/complete/reopen/archive tasks; link tasks to positions or approved placeholder entity types without duplicating task records.
- Add deadline-only reminders, notes, document references, task comments, owner/follow-up dates, and append-oriented activity events.
- Dashboard shows **real** due-today, due-this-week, overdue, awaiting-triage, my-assigned, active positions, pending approvals, and recent activity. Cards use the same server-side filters/counting semantics as their destination lists. Never display fabricated metrics as real.
- Approval Center supports `draft -> awaiting_approval -> approved|rejected -> executing -> completed|failed|cancelled`, with an explicit transition matrix, authorized actor, reviewer note, timestamp, and audit event. No external side effect and no automatic execution in Phase 2.

### 2.2 Shared Open Item Tracker — Phase 2 acceptance requirement

- A staff submitter signs in via the existing approved Google OAuth allowlist and can submit a title, question/description, optional category and priority, and an optional attachment.
- Successful submission **atomically creates a task** with `source_type = staff_submission`, `status = new`, immutable `submitted_by_user_id`, and initial activity event. It appears in Daniel's New/Open Items triage queue without email.
- A configured default assignee may receive new items. Without one, the item stays in the **unassigned** queue; do not silently assign to an arbitrary user.
- Daniel/authorized HR reviewers may assign, change priority/due date, comment, request information, resolve, reopen, or archive an item. Submitters can view and comment on **their own permitted** items but cannot change assignee, visibility, classification, approval state, or other users' items.
- Default workflow: `new -> triaged -> in_progress -> waiting_on_submitter -> resolved -> archived`; also allow `new/triaged/in_progress/waiting_on_submitter -> cancelled` with a recorded reason. Define valid transitions in one shared service function. `resolved` items may reopen; archive is reversible by admins.
- Submission comment history and all changes remain visible to an authorized reviewer. A restricted internal-only note is never visible to a submitter.
- Staff can see a simple **My Submissions** list; reviewers see **Open Items**, **Assigned to Me**, **Needs My Response**, **Overdue**, and **Resolved** filters.
- Avoid a second `open_items` or independent to-do table: use `tasks` as the canonical task record plus comments, attachments, audit, and submission metadata.

## 3. Data model and constraints

Create additive migrations with explicit indexes, foreign keys, constraints, and RLS. Minimum entities:

| Table | Required fields (beyond primary key) |
| --- | --- |
| `organizations`, `clients`, `projects` | organization linkage, name, status, audit timestamps |
| `positions`, `position_requirements` | org/client/project ids, title, owner, status, priority, openings, due date, classification, requirements |
| `tasks` | org id, title, description, task type, source type, status, priority, `submitted_by_user_id`, `assigned_to_user_id`, `created_by_user_id`, `due_date` as **DATE**, optional related entity reference, classification, visibility, created/updated/completed/archived timestamps |
| `task_comments` | task id, author, text, `visibility` (`participants` or `reviewers_only`), created/edited timestamps |
| `documents` / `task_attachments` | task id, uploader, storage provider, private object key or authoritative link, original display filename, verified MIME, file size, classification, created timestamp, disposition |
| `deadlines`, `notes`, `entity_links` | owner, source, related entity, status, timestamps, access classification |
| `approvals` | creator, approver, proposed action type, status, reviewer note, transition timestamps, optional ai-run/tool-invocation ids |
| `activity_events`, `notifications` | actor, entity id/type, action, timestamp, non-sensitive before/after summary; in-app recipient and read status where applicable |

Required semantics:

- Use validated enums/check constraints for workflow status, classification, priority, visibility, and approval states. Refuse unsupported transitions and malformed object IDs.
- `due_date` is date-only and displayed in `America/New_York`; distinguish it from timestamp columns to prevent UTC shift.
- Use `created_at`, `updated_at`, and owner/submission references consistently. Never overwrite immutable submission provenance.
- No hard-delete in normal UI. Archive/soft-delete requires actor and timestamp; preserve attachments, comments, links, and audit events according to a documented retention schedule. Retention/deletion policy is **decision pending** before real data.
- A task remains after its position closes; dashboard totals exclude archived items consistently.
- Use unique idempotency tokens for create/upload finalization to prevent duplicate tasks from double clicks and retries.

## 4. Permissions, privacy, and attachment security

Define explicit permissions: `tasks.create_own`, `tasks.read_own`, `tasks.comment_own`, `tasks.read_assigned`, `tasks.assign`, `tasks.manage`, `tasks.read_restricted`, `documents.upload_own`, `documents.read_permitted`, `approvals.review`, `positions.manage`. Extend Phase 1 roles only by migrations and tests.

Initial actors for fabricated testing:

- `administrator` (Daniel): full operational permission, subject to highest-restriction field policies.
- `staff_submitter` (Cathi example): create own submissions; read/comment/download only own permitted items; cannot browse other submitters, audit logs, system settings, compensation, or HR-restricted documents.
- `hr_reviewer`: only explicitly assigned or approved queue records; may triage, assign within allowed scope, and add reviewer-only notes.
- Default-deny unidentified, disabled, non-allowlisted, or unrelated users. **Do not reuse the broad Phase 1 `read_only` role for staff submitters:** it currently includes audit and job-read rights.

Enforce authorization in domain services AND Supabase RLS/Storage policies; UI hiding alone is insufficient. Never use a service-role client to return unfiltered task lists/attachments. Do not expose direct storage paths or public buckets. Prefer reference-only to an approved system of record when possible; for a true upload, use one explicitly approved private storage bucket and store its object key in `documents`, not uncontrolled file copies. Provide short-lived permission-checked signed download links. Do not rely on links themselves as the authorization mechanism.

For fabricated staging only, candidate supported attachment types: PDF, DOCX, XLSX, PNG, JPEG; maximum 10 MB (both configurable). Validate content signature where practical, actual MIME, extension, size, filename, authorization, and user quota on the server. Reject executables and unsupported formats. Upload completion must not leave an accessible orphan or falsely mark a failed file as attached. **Do not enable genuine HR files until storage approval, malware-handling process, retention/deletion policy, incident response, and access/revocation tests are signed off.** No public sharing or file indexing.

## 5. UX map / wireframe IDs

- `/` `dashboard`: overview cards for Open Items / New / Assigned to Me / Due Today / Overdue / Positions / Approvals; recent activity and source links.
- `/open-items` `open-items-list`: filters for New, Mine, Assigned, Waiting, Overdue, Resolved; privacy-filtered counts.
- `/open-items/new` `new-open-item-form`: title, question, type/category, optional attachment, submit, progress/error and retry states.
- `/open-items/[id]` `open-item-detail`: status, assignee, due date, file list, participant comments, restricted reviewer notes, activity history, close/reopen actions.
- `/my-submissions` `my-submissions-list`: submitter's own list and status; no other user's records.
- `/positions`, `/positions/new`, `/positions/[id]` `positions-workspace`: manual CRUD and links to tasks.
- `/tasks`, `/tasks/[id]` `tasks-workspace`: ordinary tasks with the same canonical model.
- `/approvals` `approval-center`: pending queue, proposed-action detail, explicit approve/reject notes.
- Navigation responds to permissions: staff see only Submit Item and My Submissions; administrators see full Command Center and configuration modules.

UX states required: empty list, permission denied, disconnected database, expired session, unsupported file, upload in progress/error, duplicate submit, stale version/conflict, and success with direct link to the created task. Mobile usable; ordinary keyboard and screen-reader semantics.

## 6. Proposed module/file map (Carl may adjust names in phase-start report)

| File/module | Public responsibility |
| --- | --- |
| `src/server/auth/permissions.ts` | Add typed Phase 2 permission keys; enforce role grants server-side |
| `src/server/tasks/service.ts` | `createTask`, `submitOpenItem`, `assignTask`, `transitionTask`, `addTaskComment`, `getTask`, `listTasks` |
| `src/server/tasks/validation.ts` | Zod input schemas; typed enums and date validation |
| `src/server/tasks/authorization.ts` | `canReadTask`, `canModifyTask`, `canReadAttachment` using current authenticated identity |
| `src/server/documents/service.ts` | `requestUpload`, `finalizeUpload`, `getDownloadLink`, `unlinkAttachment`; private storage only |
| `src/server/positions/service.ts` | `createPosition`, `updatePosition`, `closePosition`, `reopenPosition`, `listPositions` |
| `src/server/approvals/service.ts` | `proposeApproval`, `transitionApproval`, `listApprovals` |
| `src/server/dashboard/queries.ts` | `getDashboardCounts` backed by matching list filters |
| `src/app/(app)/open-items/**` | Open Items triage and detail screens |
| `src/app/(app)/my-submissions/**` | Staff-scoped submission screens |
| `src/app/(app)/positions/**`, `tasks/**`, `approvals/**` | Manual operational screens |
| `supabase/migrations/*_phase2_*.sql` | Additive data model, grants, RLS, private storage policies |
| `src/test/db/phase2-rls.integration.test.ts` | Cross-user, file, field, status, denied-write tests |
| `e2e/phase2-open-items.spec.ts` | Submit / assign / reply / close / dashboard flow |

All mutations require session+permission checks, Zod validation, database transactions as appropriate, protected audit events, and predictable error codes. Never trust an actor ID, org ID, or role supplied by the browser.

## 7. Acceptance tests — must pass before calling Phase 2 done

1. Admin creates position with deadline; position appears in list and matching dashboard count. Link to the existing record is direct and stable.
2. Admin creates task from position; both the task list and activity feed show the same record; closing position does not delete task/history.
3. Staff submitter creates an open item with a fabricated PDF; exactly one task appears in reviewer New queue; uploader sees status and permitted attachment.
4. Staff submits without attachment; task still appears. Empty title, invalid MIME, over-limit upload, and malformed date are rejected clearly without phantom accessible attachments.
5. Reviewer assigns, comments privately, requests clarification, resolves, and reopens the task; submitter sees allowed notes/status but **not** reviewer-only notes or administrative metadata.
6. An unrelated submitter cannot view, enumerate, edit, comment on, or download someone else's task or attachment via direct URL, API, SQL client, or guessed object path. Negative tests prove RLS and Storage denial.
7. `read_only` role cannot accidentally gain staff submission privileges or new private data access; anonymous and inactive identities are denied.
8. Repeated submit/retry/double-click produces one task and no orphan file. Upload timeout and partial failures have deterministic recovery and audit states.
9. Complete/reopen/archive and due-date changes update filtered list/dashboard counts consistently; date-only values do not shift across UTC boundaries or DST.
10. Unauthorized approval transition is denied; authorized approve/reject records actor/timestamp/audit; no email, calendar, ATS, or AI call occurs.
11. Position, task, comment, and attachment queries exclude restricted compensation/employee information for submitters and ordinary reviewers.
12. CI: secret scan, dependency audit, lint, typecheck, unit tests, production build, Playwright, migration reset, new RLS/storage integration tests, and existing Phase 0/1 regression suites all green on the exact head.
13. Staging uses fabricated data and nonproduction credentials only. Manual sign-in tests with at least administrator, submitter, reviewer, and unauthorized accounts pass.
14. Phase completion report includes changed files, migrations, environment-variable names only, tests/run URLs, limitations, manual acceptance evidence, and rollback steps. Daniel and Code Coach review required before merge.

## 8. Assumptions and open decisions (explicit; do not infer production approval)

- Phase 2 extends the originally Daniel-only roadmap for a **restricted** staff intake experience, not general staff access to HRIS. Amend roadmap/Decision Register before code.
- The approved authoritative storage location for genuine uploads is not yet chosen. Stage with fabricated files using a private storage implementation, then obtain a production storage/retention/security decision.
- Default assignee is unset; use New/Triage unless Daniel specifies one. No automatic emails or Slack messages.
- Staff may create only ordinary/internal-classification items initially; confidential/highly restricted files are blocked pending separate permission, storage, and privacy approval.
- All real employee and candidate records stay out of staging, fixtures, screenshots, and this public repository.
- D06 Trigger.dev / Pattern C remains reserved for later workers; Phase 2 must not enable them.

## 9. Carl — ordered task list

1. PR #2 is merged. Pull updated `main`; create `phase-2/command-center-mvp` from the merge commit **only after this kickoff is approved**. Do not make Phase 2 application changes on other branches.
2. Update source-of-truth roadmap and Decision Register D07/D23 to reflect the restricted staff submission exception and file storage approval gate; clean stale public/private wording before code. Show the proposed policy change to Daniel for sign-off.
3. Write the phase-start report and schema/permission/transition matrix. List exact files, migrations, and an incremental reversible implementation plan; get kickoff approval before implementation.
4. Implement additive SQL schema and RLS/Storage policies first, with cross-user negative integration tests. No real data.
5. Build canonical task service, submission/comment/attachment flows, staff-aware nav, and reviewer triage UI. Add idempotency and audit events.
6. Build positions, ordinary tasks/deadlines, dashboard count queries, and approval state machine; maintain Phase 1 restrictions and no external side effects.
7. Add unit, migration, negative security, and Playwright critical-journey tests; keep existing full CI suite green.
8. Deliver complete change summary, manual validation, rollback plan, and Phase 2 readiness score. Do not merge or expose to staff without Daniel's approval.

**Approval gate:** Approving this brief authorizes the *planning and then approved Phase 2 development scope*, not production use of staff uploads or real HR data. Those require separate deployment, access, storage, and retention approval.
