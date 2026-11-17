-- Phase 2 Slice A — permissions, helpers, minimal SELECT policies
-- Authenticated clients remain read-only via RLS; mutations use service-role
-- after explicit server-side authorization (documented for later slices).

-- ---------------------------------------------------------------------------
-- Permission keys
-- ---------------------------------------------------------------------------

INSERT INTO public.permissions (key, name, description) VALUES
  ('tasks.create_own', 'Create Own Tasks', 'Create own staff submissions / permitted tasks'),
  ('tasks.read_own', 'Read Own Tasks', 'Read own submitted or participant tasks'),
  ('tasks.comment_own', 'Comment Own Tasks', 'Comment on own permitted tasks'),
  ('tasks.read_assigned', 'Read Assigned Tasks', 'Read tasks assigned to the actor'),
  ('tasks.assign', 'Assign Tasks', 'Assign tasks within authorized scope'),
  ('tasks.manage', 'Manage Tasks', 'Manage tasks within authorized scope'),
  ('tasks.read_restricted', 'Read Restricted Tasks', 'Read restricted-classification tasks'),
  ('documents.upload_own', 'Upload Own Documents', 'Upload attachment metadata for own items'),
  ('documents.read_permitted', 'Read Permitted Documents', 'Read permitted document metadata'),
  ('approvals.review', 'Review Approvals', 'Review approvals in authorized scope'),
  ('positions.manage', 'Manage Positions', 'Manage positions in authorized scope'),
  ('positions.read', 'Read Positions', 'Read non-compensation position fields'),
  ('compensation.read', 'Read Compensation', 'Read position_compensation rows'),
  ('org.membership.read', 'Read Org Membership', 'Read own organization memberships')
ON CONFLICT (key) DO NOTHING;

-- Administrator: all permissions (including new keys)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'administrator'
ON CONFLICT DO NOTHING;

-- staff_submitter: narrow own-item grants (never audit/jobs)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'staff_submitter'
  AND p.key IN (
    'app.access',
    'tasks.create_own',
    'tasks.read_own',
    'tasks.comment_own',
    'documents.upload_own',
    'documents.read_permitted',
    'org.membership.read'
  )
ON CONFLICT DO NOTHING;

-- hr_reviewer: assigned + queue triage (never audit/jobs/compensation by default)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'hr_reviewer'
  AND p.key IN (
    'app.access',
    'tasks.read_assigned',
    'tasks.assign',
    'tasks.comment_own',
    'documents.read_permitted',
    'approvals.review',
    'positions.read',
    'org.membership.read'
  )
ON CONFLICT DO NOTHING;

-- Explicitly ensure read_only does NOT receive Phase 2 keys
DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.key = 'read_only'
  AND p.key IN (
    'tasks.create_own',
    'tasks.read_own',
    'tasks.comment_own',
    'tasks.read_assigned',
    'tasks.assign',
    'tasks.manage',
    'tasks.read_restricted',
    'documents.upload_own',
    'documents.read_permitted',
    'approvals.review',
    'positions.manage',
    'positions.read',
    'compensation.read',
    'org.membership.read'
  );

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers for RLS predicates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_active_org_member(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = public.current_app_user_id()
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_queue_triage_org(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = public.current_app_user_id()
      AND m.status = 'active'
      AND m.can_queue_triage = true
  )
  AND public.has_permission('tasks.read_assigned');
$$;

CREATE OR REPLACE FUNCTION public.can_select_task(p_task public.tasks)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
BEGIN
  uid := public.current_app_user_id();
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_permission('tasks.manage')
     AND public.is_active_org_member(p_task.organization_id) THEN
    RETURN true;
  END IF;

  -- Own staff submission / own created ordinary task
  IF public.has_permission('tasks.read_own')
     AND (
       p_task.submitted_by_user_id = uid
       OR p_task.created_by_user_id = uid
     )
     AND p_task.classification = 'internal' THEN
    RETURN true;
  END IF;

  -- Explicit assignee
  IF public.has_permission('tasks.read_assigned')
     AND p_task.assigned_to_user_id = uid THEN
    RETURN true;
  END IF;

  -- Org intake queue for staff submissions (internal only)
  IF p_task.source_type = 'staff_submission'
     AND p_task.classification = 'internal'
     AND p_task.status IN ('new', 'triaged', 'in_progress', 'waiting_on_submitter')
     AND public.can_queue_triage_org(p_task.organization_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_select_task_id(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT public.can_select_task(t)
      FROM public.tasks t
      WHERE t.id = p_task_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_org_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_queue_triage_org(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_select_task(public.tasks) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_select_task_id(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_queue_triage_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_select_task(public.tasks) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_select_task_id(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- SELECT policies (no INSERT/UPDATE/DELETE for authenticated)
-- ---------------------------------------------------------------------------

CREATE POLICY organizations_select_member
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_active_org_member(id));

CREATE POLICY organization_memberships_select_own_or_admin
  ON public.organization_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR (
      public.has_permission('tasks.manage')
      AND public.is_active_org_member(organization_id)
    )
  );

CREATE POLICY clients_select_member
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('positions.read')
      OR public.has_permission('positions.manage')
      OR public.has_permission('tasks.manage')
    )
  );

CREATE POLICY projects_select_member
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('positions.read')
      OR public.has_permission('positions.manage')
      OR public.has_permission('tasks.manage')
    )
  );

CREATE POLICY positions_select_member
  ON public.positions
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('positions.read')
      OR public.has_permission('positions.manage')
      OR public.has_permission('tasks.manage')
    )
  );

-- Compensation: separate grant; staff_submitter / default reviewer denied
CREATE POLICY position_compensation_select_restricted
  ON public.position_compensation
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('compensation.read')
    AND public.is_active_org_member(organization_id)
  );

CREATE POLICY position_requirements_select_member
  ON public.position_requirements
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('positions.read')
      OR public.has_permission('positions.manage')
      OR public.has_permission('tasks.manage')
    )
  );

CREATE POLICY tasks_select_authorized
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (public.can_select_task(tasks));

CREATE POLICY deadlines_select_member_manage
  ON public.deadlines
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('tasks.manage')
      OR owner_user_id = public.current_app_user_id()
    )
  );

CREATE POLICY notes_select_via_task
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (
    related_task_id IS NOT NULL
    AND public.can_select_task_id(related_task_id)
    AND (
      visibility = 'participants'
      OR (
        visibility = 'reviewers_only'
        AND (
          public.has_permission('tasks.manage')
          OR public.has_permission('tasks.assign')
          OR public.has_permission('approvals.review')
        )
      )
    )
  );

CREATE POLICY entity_links_select_via_task
  ON public.entity_links
  FOR SELECT
  TO authenticated
  USING (
    (
      from_entity_type = 'task'
      AND public.can_select_task_id(from_entity_id)
    )
    OR (
      to_entity_type = 'task'
      AND public.can_select_task_id(to_entity_id)
    )
    OR (
      public.has_permission('tasks.manage')
      AND public.is_active_org_member(organization_id)
    )
  );

CREATE POLICY approvals_select_scoped
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_org_member(organization_id)
    AND (
      public.has_permission('tasks.manage')
      OR (
        public.has_permission('approvals.review')
        AND (
          approver_user_id = public.current_app_user_id()
          OR created_by_user_id = public.current_app_user_id()
        )
      )
    )
  );

CREATE POLICY activity_events_select_via_task
  ON public.activity_events
  FOR SELECT
  TO authenticated
  USING (
    (
      entity_type = 'task'
      AND public.can_select_task_id(entity_id)
    )
    OR (
      public.has_permission('tasks.manage')
      AND public.is_active_org_member(organization_id)
    )
  );

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_user_id = public.current_app_user_id());

CREATE POLICY task_comments_select_scoped
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    public.can_select_task_id(task_id)
    AND (
      visibility = 'participants'
      OR (
        visibility = 'reviewers_only'
        AND (
          public.has_permission('tasks.manage')
          OR public.has_permission('tasks.assign')
          OR public.has_permission('approvals.review')
        )
      )
    )
  );

CREATE POLICY documents_select_permitted
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('documents.read_permitted')
    AND (
      uploaded_by_user_id = public.current_app_user_id()
      OR (
        task_id IS NOT NULL
        AND public.can_select_task_id(task_id)
      )
      OR (
        public.has_permission('tasks.manage')
        AND public.is_active_org_member(organization_id)
      )
    )
    AND classification = 'internal'
  );

CREATE POLICY task_attachments_select_via_task
  ON public.task_attachments
  FOR SELECT
  TO authenticated
  USING (public.can_select_task_id(task_id));

-- idempotency_keys: RLS on, no authenticated policies → deny
