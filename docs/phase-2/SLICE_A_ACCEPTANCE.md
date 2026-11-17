# Phase 2 — Slice A Acceptance Contract

**Status:** Code Coach approved for fabricated-data implementation; November 17, 2026.  
**Repository:** RVA-Ranks/HRIS-SUite (intentionally public).  
**Approved base:** `main` at `7a944a845ed568d756b5d9dc0a14322c0c26f027` (PR #5 later merged; implement from updated `main`).  
**Implementation branch:** `phase-2/command-center-mvp`.  
**Related start report:** `docs/phase-2/PHASE_2_START.md`.

## 1. Scope and planned files

Slice A is schema, permissions, default-deny RLS and negative integration tests only. No Phase 2 feature UI, staff rollout, true document upload, worker, AI or external write.

- `supabase/migrations/20261118000000_phase2_core_entities.sql` — organizations/clients/projects, positions/requirements, tasks/deadlines/notes, links, approvals, activity and notifications; constraints/indexes.
- `supabase/migrations/20261118010000_phase2_open_items_comments_attachments.sql` — comments, documents/attachment metadata, idempotency records and constraints.
- `supabase/migrations/20261118020000_phase2_permissions_rls.sql` — approved permission keys, mappings and narrowly scoped SELECT policies.
- `src/server/auth/permissions.ts` — typed permission names, with no new privileges accidentally granted to `read_only`.
- `src/test/db/phase2-rls.integration.test.ts` — negative/positive tests for tables, roles, org boundaries and restricted fields.

Keep these filenames stable unless a real migration name collision occurs. Any `20261118030000_phase2_storage_bucket.sql` implementation belongs to Slice C and is not part of Slice A.

## 2. Mandatory SQL invariant

Enable RLS and deny untrusted access in the **same migration that creates each table**. Do not create an unprotected operational table in migration 1 or 2 and wait until migration 3 to enable RLS. Use `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` immediately after table creation, and audit effective grants to `anon` and `authenticated` as well as RLS policies. Migration 3 should introduce explicit, minimal permissions and policy grants. Ensure no unintended object is exposed between migrations or after a partial failure.

For each table, verify expected table/column types, CHECK constraints, referenced keys, ON DELETE behavior, indexes for RLS predicates, and `created_at`/`updated_at` management. Staging-only schema must be resettable from scratch.

## 3. Authorization model

- A `staff_submitter` may see only its own permitted internal-classification tasks, comments and attachment metadata. No audit/job log, settings or compensation access.
- An `hr_reviewer` may access explicitly assigned items or the internal-classification intake queue of organizations where they have trusted, active membership and a queue-triage grant. The reviewer role by itself does not grant blanket access to every submission.
- An administrator may operate approved scope without bypassing higher-restriction field rules or audit requirements.
- Legacy `read_only` receives no Phase 2 privileges. Anonymous, unallowlisted, inactive and unrelated accounts are denied.
- Exactly one exclusive OAuth bootstrap baseline role is allowed. Check for any additional role grants that might inadvertently broaden permissions.
- Never trust `actor_id`, `org_id`, role, owner or privilege flags passed from browser input.
- Restrict joins and direct reads across comments, document metadata, activity, notifications and entity links; ownership of the parent task does not confer access to `reviewers_only` records.
- Sensitive compensation is kept in a separately authorized table, not in broadly readable `positions` rows. Postgres row policies alone do not mask columns.

## 4. Task and approval constraints

A canonical `tasks` table represents ordinary work and staff-submitted open items. Use `source_type` (or explicit task subtype) and validate status sets per subtype. Staff submissions default to `new`; ordinary tasks must not be forced into the staff-submission status progression. Ensure no hard deletion through the normal application.

Use PostgreSQL `DATE` for due dates, with application interpretation in `America/New_York`. Timestamp columns remain timezone-aware. Add tests across daylight-saving transitions and UTC boundaries.

Define allowable approval transition states and their audit fields, but keep `executing`, `completed` and `failed` unreachable through Phase 2 user-facing actions; no external execution exists yet.

## 5. Privileged server writes

The Supabase service-role client bypasses RLS. Any subsequent mutation service must resolve the authenticated actor, validate scope/permission against the target record, and perform validated data + activity/audit changes atomically in Postgres. Do not assume that RLS protects a route using the service-role key. Prefer small trusted SQL functions or explicit transactional server boundaries; document error semantics, optimistic concurrency and idempotency.

## 6. Slice A acceptance checks

1. After each of migrations 1 and 2, inspect RLS flags and grants; anonymous and unapproved authenticated accounts cannot access the new operational tables.
2. After migration 3, create fabricated admin, submitter, reviewer, read-only, unrelated, inactive and anonymous identities; assert both authorized and denied queries.
3. Two submitters cannot enumerate or retrieve each other's tasks, comments, document metadata, links or activity via direct queries or guessed IDs.
4. A reviewer cannot browse another organization's queue or highly restricted fields; an authorized queue reviewer may see only the permitted intake subset.
5. `read_only` cannot create, edit or access newly restricted data; staff and reviewer roles have neither `audit.read` nor `jobs.read`.
6. A disabled account cannot reactivate through OAuth; bootstrap role changes do not leave legacy roles or unexpected elevated grants.
7. Constraints reject unsupported task states, broken relationships, impossible dates and invalid foreign keys; due dates are PostgreSQL `DATE`.
8. Complete migration reset and Phase 0/1 regression suites remain green. Verify production-high and full-critical audit gates, lint, typecheck, unit, build, Playwright and Supabase RLS integration on the exact PR head.
9. Commit only fabricated data and no real credentials, employees or attachments.
10. Deliver an explicit changelog, migration list, SQL grants/policy matrix, rollback plan and test run URLs before claiming Slice A complete.

## 7. Deploy/rollback

Use isolated Supabase dev/staging, no production data, and no staff production login. Apply migrations chronologically. Use forward-only compensating migrations for corrections; do not casually drop tables containing data. No Supabase Storage bucket is deployed as part of Slice A; it is reserved for Slice C.

**Approval:** Daniel/Code Coach authorizes Slice A implementation, not its automatic merge or production deployment. Subsequent PRs retain normal review gates.

**Suggested commit:** `docs(phase-2): specify Slice A zero-exposure RLS and scope tests`
