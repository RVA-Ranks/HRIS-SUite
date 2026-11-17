import { createClient } from "@/lib/supabase/server";

export type JobRunRow = {
  id: string;
  job_key: string;
  idempotency_key: string;
  state: string;
  attempt_count: number;
  last_error: string | null;
  trigger_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export async function listJobRuns(limit = 50): Promise<{
  rows: JobRunRow[];
  error?: string;
  disconnected: boolean;
}> {
  const supabase = await createClient();
  if (!supabase) {
    return { rows: [], error: "Database not configured.", disconnected: true };
  }

  const { data, error } = await supabase
    .from("job_runs")
    .select(
      "id, job_key, idempotency_key, state, attempt_count, last_error, trigger_run_id, started_at, finished_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { rows: [], error: error.message, disconnected: false };
  }

  return { rows: data ?? [], disconnected: false };
}
