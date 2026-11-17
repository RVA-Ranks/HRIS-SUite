-- Phase 2 Slice A — core entities
-- Fabricated schema only. RLS enabled immediately on every table (default deny).
-- Explicit SELECT policies arrive in 20261118020000_phase2_permissions_rls.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations & membership (queue eligibility)
-- ---------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organizations FROM PUBLIC;
REVOKE ALL ON TABLE public.organizations FROM anon, authenticated;
GRANT SELECT ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;

CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  -- Trusted queue-triage grant for hr_reviewer intake within this org.
  can_queue_triage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_memberships_user_idx
  ON public.organization_memberships (user_id)
  WHERE status = 'active';

CREATE INDEX organization_memberships_org_triage_idx
  ON public.organization_memberships (organization_id)
  WHERE status = 'active' AND can_queue_triage = true;

ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_memberships FROM PUBLIC;
REVOKE ALL ON TABLE public.organization_memberships FROM anon, authenticated;
GRANT SELECT ON TABLE public.organization_memberships TO authenticated;
GRANT ALL ON TABLE public.organization_memberships TO service_role;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clients_org_idx ON public.clients (organization_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.clients FROM PUBLIC;
REVOKE ALL ON TABLE public.clients FROM anon, authenticated;
GRANT SELECT ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_org_idx ON public.projects (organization_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.projects FROM PUBLIC;
REVOKE ALL ON TABLE public.projects FROM anon, authenticated;
GRANT SELECT ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;

-- ---------------------------------------------------------------------------
-- Positions (no compensation columns — see position_compensation)
-- ---------------------------------------------------------------------------

CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft', 'open', 'on_hold', 'filled', 'closed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  openings integer NOT NULL DEFAULT 1 CHECK (openings >= 0),
  location text,
  clearance text,
  due_date date,
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  archived_at timestamptz
);

CREATE INDEX positions_org_status_idx ON public.positions (organization_id, status);
CREATE INDEX positions_due_date_idx ON public.positions (due_date);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.positions FROM PUBLIC;
REVOKE ALL ON TABLE public.positions FROM anon, authenticated;
GRANT SELECT ON TABLE public.positions TO authenticated;
GRANT ALL ON TABLE public.positions TO service_role;

-- Highly restricted compensation — separate table (row policies do not mask columns).
CREATE TABLE public.position_compensation (
  position_id uuid PRIMARY KEY REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  currency_code text NOT NULL DEFAULT 'USD' CHECK (char_length(currency_code) = 3),
  min_amount numeric(14, 2),
  max_amount numeric(14, 2),
  pay_type text CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'salary', 'contract')),
  notes text,
  classification text NOT NULL DEFAULT 'restricted'
    CHECK (classification IN ('confidential', 'restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    min_amount IS NULL
    OR max_amount IS NULL
    OR min_amount <= max_amount
  )
);

CREATE INDEX position_compensation_org_idx
  ON public.position_compensation (organization_id);

ALTER TABLE public.position_compensation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.position_compensation FROM PUBLIC;
REVOKE ALL ON TABLE public.position_compensation FROM anon, authenticated;
GRANT SELECT ON TABLE public.position_compensation TO authenticated;
GRANT ALL ON TABLE public.position_compensation TO service_role;

CREATE TABLE public.position_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requirement_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX position_requirements_position_idx
  ON public.position_requirements (position_id);

ALTER TABLE public.position_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.position_requirements FROM PUBLIC;
REVOKE ALL ON TABLE public.position_requirements FROM anon, authenticated;
GRANT SELECT ON TABLE public.position_requirements TO authenticated;
GRANT ALL ON TABLE public.position_requirements TO service_role;

-- ---------------------------------------------------------------------------
-- Tasks (canonical ordinary + staff_submission)
-- ---------------------------------------------------------------------------

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'general'
    CHECK (task_type IN ('general', 'follow_up', 'open_item', 'deadline', 'approval')),
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'staff_submission', 'system', 'import')),
  status text NOT NULL,
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  submitted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  related_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  due_date date,
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'restricted')),
  visibility text NOT NULL DEFAULT 'organization'
    CHECK (visibility IN ('organization', 'participants', 'restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT tasks_status_by_source CHECK (
    (
      source_type = 'staff_submission'
      AND status IN (
        'new',
        'triaged',
        'in_progress',
        'waiting_on_submitter',
        'resolved',
        'cancelled',
        'archived'
      )
      AND submitted_by_user_id IS NOT NULL
    )
    OR (
      source_type IN ('manual', 'system', 'import')
      AND status IN (
        'open',
        'in_progress',
        'blocked',
        'completed',
        'cancelled',
        'archived'
      )
    )
  )
);

CREATE INDEX tasks_org_status_idx ON public.tasks (organization_id, status);
CREATE INDEX tasks_assigned_idx ON public.tasks (assigned_to_user_id);
CREATE INDEX tasks_submitted_by_idx ON public.tasks (submitted_by_user_id);
CREATE INDEX tasks_due_date_idx ON public.tasks (due_date);
CREATE INDEX tasks_source_status_idx ON public.tasks (source_type, status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tasks FROM PUBLIC;
REVOKE ALL ON TABLE public.tasks FROM anon, authenticated;
GRANT SELECT ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;

CREATE TABLE public.deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date NOT NULL,
  owner_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deadlines_org_due_idx ON public.deadlines (organization_id, due_date);

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.deadlines FROM PUBLIC;
REVOKE ALL ON TABLE public.deadlines FROM anon, authenticated;
GRANT SELECT ON TABLE public.deadlines TO authenticated;
GRANT ALL ON TABLE public.deadlines TO service_role;

CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'participants'
    CHECK (visibility IN ('participants', 'reviewers_only')),
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notes_task_idx ON public.notes (related_task_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notes FROM PUBLIC;
REVOKE ALL ON TABLE public.notes FROM anon, authenticated;
GRANT SELECT ON TABLE public.notes TO authenticated;
GRANT ALL ON TABLE public.notes TO service_role;

CREATE TABLE public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_entity_type text NOT NULL,
  from_entity_id uuid NOT NULL,
  to_entity_type text NOT NULL,
  to_entity_id uuid NOT NULL,
  link_type text NOT NULL DEFAULT 'related',
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_entity_type, from_entity_id, to_entity_type, to_entity_id, link_type)
);

CREATE INDEX entity_links_from_idx
  ON public.entity_links (from_entity_type, from_entity_id);

ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.entity_links FROM PUBLIC;
REVOKE ALL ON TABLE public.entity_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.entity_links TO authenticated;
GRANT ALL ON TABLE public.entity_links TO service_role;

-- Approvals: executing/completed/failed exist for future phases but Phase 2
-- user-facing services must not transition into them (no external execution).
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approver_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  proposed_action_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'awaiting_approval',
      'approved',
      'rejected',
      'executing',
      'completed',
      'failed',
      'cancelled'
    )),
  reviewer_note text,
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ai_run_id uuid,
  tool_invocation_id uuid,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX approvals_org_status_idx ON public.approvals (organization_id, status);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.approvals FROM PUBLIC;
REVOKE ALL ON TABLE public.approvals FROM anon, authenticated;
GRANT SELECT ON TABLE public.approvals TO authenticated;
GRANT ALL ON TABLE public.approvals TO service_role;

CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  before_summary text,
  after_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_events_entity_idx
  ON public.activity_events (entity_type, entity_id, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.activity_events FROM PUBLIC;
REVOKE ALL ON TABLE public.activity_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.activity_events TO authenticated;
GRANT ALL ON TABLE public.activity_events TO service_role;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type text,
  entity_id uuid,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_recipient_idx
  ON public.notifications (recipient_user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
