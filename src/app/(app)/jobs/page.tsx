import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listJobRuns, type JobRunRow } from "@/server/data/jobs";
import { PERMISSION_KEYS } from "@/server/auth/permissions";
import { redirectForAuthError } from "@/server/auth/redirect";
import { requirePermission } from "@/server/auth/require-user";

function stateVariant(state: string): "default" | "success" | "warning" | "danger" | "muted" {
  switch (state) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
      return "default";
    default:
      return "muted";
  }
}

export default async function JobsPage() {
  try {
    await requirePermission(PERMISSION_KEYS.JOBS_READ);
  } catch (error) {
    redirectForAuthError(error);
  }

  const { rows, error, disconnected } = await listJobRuns();

  return (
    <div>
      <PageHeader
        title="Job runs"
        description="Durable job execution history. Trigger.dev wiring is deferred in Phase 1."
        actions={
          disconnected ? (
            <Badge variant="warning">Worker disconnected</Badge>
          ) : (
            <Badge variant="muted">DB connected</Badge>
          )
        }
      />

      {error && <ErrorState title="Unable to load job runs" message={error} />}

      {!error && rows.length === 0 && (
        <EmptyState
          title="No job runs recorded"
          description="The job_runs table is ready for Trigger.dev. Until workers are provisioned, this view stays empty by design."
        />
      )}

      {!error && rows.length > 0 && (
        <DataTable<JobRunRow>
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            {
              key: "job_key",
              header: "Job",
              render: (row) => row.job_key,
            },
            {
              key: "state",
              header: "State",
              render: (row) => (
                <Badge variant={stateVariant(row.state)}>{row.state}</Badge>
              ),
            },
            {
              key: "attempt_count",
              header: "Attempts",
              render: (row) => row.attempt_count,
            },
            {
              key: "trigger_run_id",
              header: "Trigger run",
              render: (row) => row.trigger_run_id ?? "—",
            },
            {
              key: "created_at",
              header: "Created",
              render: (row) => new Date(row.created_at).toLocaleString(),
            },
          ]}
        />
      )}
    </div>
  );
}
