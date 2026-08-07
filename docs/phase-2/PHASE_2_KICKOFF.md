# Phase 2 kickoff brief — Command Center manual MVP

**Status:** Draft for Code Coach / Daniel review — **do not implement until approved**  
**After Phase 1 merge:** create branch `phase-2/command-center-mvp`  
**Date:** August 7, 2026

---

## Objective

Deliver a usable Daniel-only Command Center with **manual** create/view/update of connected operational records. Prove the internal data model and UX **without** external automation.

## In scope

1. Additive migrations + RLS for Phase 2 entities (roadmap §10.1):
   - `organizations` (or single org record), `clients`, `projects`
   - `positions`, `position_requirements`
   - `tasks`, `deadlines`, `notes`
   - `documents` (references/metadata only)
   - `entity_links`, `approvals`, `activity_events`, `notifications`
2. Command Center homepage driven by real DB queries (due today/week, overdue, active positions, approvals queue, recent activity). Empty/disconnected states remain honest.
3. Manual position CRUD (client/project, priority, status, openings, location, compensation fields permission-aware, clearance, deadline, notes, related tasks, activity).
4. Manual tasks/deadlines with links to positions (and placeholders for later candidate/employee/email/compliance).
5. Approval Center foundation state machine: Draft → Awaiting approval → Approved/Rejected → Executing → Completed/Failed/Cancelled. Optional `ai_run_id` / `tool_invocation_id`. **No external side effects.**
6. Reuse Phase 1 shell, RBAC, audit, feature flags. Server `requirePermission` on every page/mutation.
7. Fabricated seed data for staging only. Tests: unit + Playwright for create position → task → dashboard counts.

## Explicitly out of scope

- JazzHR sync, Gmail scan, calendar writes, résumé matching
- Live Trigger.dev workers / OpenAI enablement
- Production credentials or real employee/candidate data
- Autonomous sends, publishes, or ATS writes
- Rewriting Performance Review / Compensation Apps Script systems

## Security constraints

- Repository remains intentionally public for review; never commit secrets or HR PII.
- Service-role / admin client only on approved server paths; browser clients stay RLS SELECT + mutation-deny.
- Pattern C for future jobs (not required in Phase 2 MVP).

## Acceptance (from roadmap §10.6, abbreviated)

- Create position with deadline → visible on dashboard.
- Add task from position → visible in task list and position activity.
- Completing a task updates dashboard counts consistently.
- Closing a position does not delete tasks/history.
- Approve/reject a proposed approval with audit event.
- Direct URLs open correct records; filters/sorts stable; empty states clear.

## Deliverables at kickoff approval

1. Phase-start report on `phase-2/command-center-mvp` before coding.
2. Small coherent PRs; no Phase 2 work on the Phase 1 branch.
3. Phase completion package when the gate is claimed.

## Ask for approval

Approve this brief to authorize Carl to create `phase-2/command-center-mvp` and implement only the scope above.
