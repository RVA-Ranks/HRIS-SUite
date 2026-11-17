-- Phase 2 Slice A — open-item comments, document metadata, idempotency
-- Storage bucket is Slice C. RLS enabled immediately (default deny).

CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'participants'
    CHECK (visibility IN ('participants', 'reviewers_only')),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);

CREATE INDEX task_comments_task_idx
  ON public.task_comments (task_id, created_at);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.task_comments FROM PUBLIC;
REVOKE ALL ON TABLE public.task_comments FROM anon, authenticated;
GRANT SELECT ON TABLE public.task_comments TO authenticated;
GRANT ALL ON TABLE public.task_comments TO service_role;

-- Attachment / document metadata only (no Storage bucket in Slice A).
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_provider text NOT NULL DEFAULT 'supabase_storage'
    CHECK (storage_provider IN ('supabase_storage', 'external_reference')),
  object_key text,
  external_url text,
  original_filename text NOT NULL,
  verified_mime text,
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  classification text NOT NULL DEFAULT 'internal'
    CHECK (classification IN ('internal', 'confidential', 'restricted')),
  disposition text NOT NULL DEFAULT 'pending'
    CHECK (disposition IN ('pending', 'validated', 'linked', 'rejected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (storage_provider = 'supabase_storage' AND object_key IS NOT NULL)
    OR (storage_provider = 'external_reference' AND external_url IS NOT NULL)
    OR disposition = 'pending'
  )
);

CREATE INDEX documents_task_idx ON public.documents (task_id);
CREATE INDEX documents_uploader_idx ON public.documents (uploaded_by_user_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.documents FROM PUBLIC;
REVOKE ALL ON TABLE public.documents FROM anon, authenticated;
GRANT SELECT ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, document_id)
);

CREATE INDEX task_attachments_task_idx ON public.task_attachments (task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.task_attachments FROM PUBLIC;
REVOKE ALL ON TABLE public.task_attachments FROM anon, authenticated;
GRANT SELECT ON TABLE public.task_attachments TO authenticated;
GRANT ALL ON TABLE public.task_attachments TO service_role;

CREATE TABLE public.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  resource_type text,
  resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, scope, idempotency_key)
);

CREATE INDEX idempotency_keys_org_idx ON public.idempotency_keys (organization_id);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.idempotency_keys FROM PUBLIC;
REVOKE ALL ON TABLE public.idempotency_keys FROM anon, authenticated;
-- No SELECT grant to authenticated: idempotency is server-side only.
GRANT ALL ON TABLE public.idempotency_keys TO service_role;
