import { createClient } from "@/lib/supabase/server";

export type AuditEventRow = {
  id: string;
  timestamp: string;
  action_type: string;
  actor_type: string;
  entity_type: string | null;
  entity_id: string | null;
  source: string;
  correlation_id: string | null;
};

export async function listAuditEvents(limit = 50): Promise<{
  rows: AuditEventRow[];
  error?: string;
}> {
  const supabase = await createClient();
  if (!supabase) {
    return { rows: [], error: "Database not configured." };
  }

  const { data, error } = await supabase
    .from("audit_events")
    .select(
      "id, timestamp, action_type, actor_type, entity_type, entity_id, source, correlation_id",
    )
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: data ?? [] };
}
