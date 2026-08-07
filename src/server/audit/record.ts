import { getCorrelationId } from "@/lib/correlation";
import { logger } from "@/lib/logger";
import { createAdminClientOrNull } from "@/lib/supabase/admin";

export type AuditEventInput = {
  actorUserId?: string | null;
  actorType?: string;
  actionType: string;
  entityType?: string;
  entityId?: string;
  beforeSummary?: string;
  afterSummary?: string;
  source?: string;
  errorCode?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type AuditRecorder = (
  input: AuditEventInput,
) => Promise<{ ok: boolean; id?: string }>;

let auditRecorderOverride: AuditRecorder | null = null;

export function setAuditRecorderForTests(recorder: AuditRecorder | null): void {
  auditRecorderOverride = recorder;
}

/**
 * Append-only audit writes use the service-role client because operational
 * tables deny direct INSERT from authenticated/anon under Phase 1 RLS.
 */
const defaultAuditRecorder: AuditRecorder = async (input) => {
  const admin = createAdminClientOrNull();
  if (!admin) {
    logger.warn("audit.record skipped — service role unavailable", {
      actionType: input.actionType,
    });
    return { ok: false };
  }

  const correlationId = input.correlationId ?? (await getCorrelationId());

  const { data, error } = await admin
    .from("audit_events")
    .insert({
      actor_user_id: input.actorUserId ?? null,
      actor_type: input.actorType ?? "user",
      action_type: input.actionType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      before_summary: input.beforeSummary ?? null,
      after_summary: input.afterSummary ?? null,
      source: input.source ?? "app",
      error_code: input.errorCode ?? null,
      correlation_id: correlationId,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    logger.error("audit.record failed", {
      actionType: input.actionType,
      error: error.message,
    });
    return { ok: false };
  }

  return { ok: true, id: data.id };
};

export async function recordAuditEvent(
  input: AuditEventInput,
): Promise<{ ok: boolean; id?: string }> {
  const recorder = auditRecorderOverride ?? defaultAuditRecorder;
  return recorder(input);
}
