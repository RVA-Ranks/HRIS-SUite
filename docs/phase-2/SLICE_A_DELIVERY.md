# Slice A delivery notes

**Branch:** `phase-2/command-center-mvp`  
**Base:** `main` including PR #5 merge  
**Scope:** schema + permissions + default-deny RLS + negative tests only  

## Migrations (apply in order)

1. `20261118000000_phase2_core_entities.sql` — orgs/membership/clients/projects/positions/`position_compensation`/requirements/tasks/deadlines/notes/links/approvals/activity/notifications; **RLS + revoke/grant on create**  
2. `20261118010000_phase2_open_items_comments_attachments.sql` — comments/documents/attachments/idempotency; **RLS on create**; no Storage bucket  
3. `20261118020000_phase2_permissions_rls.sql` — permission keys, role maps, helpers, SELECT policies  

Reset: `supabase db reset --yes` (staging/dev only).

## Policy matrix (authenticated SELECT)

| Object | Who may SELECT |
| --- | --- |
| `organizations` / memberships | Active members (own membership rows; admin manage within membership) |
| `positions` / requirements / clients / projects | Org members with `positions.read` / `positions.manage` / `tasks.manage` |
| `position_compensation` | `compensation.read` + org membership only |
| `tasks` | `can_select_task`: manage+member, own internal submission, assignee, or org queue-triage intake |
| `task_comments` / notes | Via task access; `reviewers_only` requires assign/manage/approvals.review |
| `documents` / `task_attachments` | Permitted readers via task/uploader; internal classification |
| `idempotency_keys` | No authenticated access |
| Mutations | No authenticated INSERT/UPDATE/DELETE policies — service-role after server authz |

## Tests

- `src/test/db/phase2-rls.integration.test.ts`  
- Unit: Phase 2 permission key exports  

## Rollback

Forward-only compensating migrations if needed. Do not drop tables with data casually. Disable Phase 2 role email maps to stop new restricted logins. No Storage deployed in Slice A.

## Residual advisory

See `docs/phase-2/PICOMATCH_ADVISORY.md` — full-tree high `picomatch` remains unfixed upstream; CI keeps production-high + full-critical gates.
