import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAuditEvents, type AuditEventRow } from "@/server/data/audit";

export default async function AuditPage() {
  const { rows, error } = await listAuditEvents();

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Append-only audit events for authentication and platform actions."
      />

      {error && <ErrorState title="Unable to load audit events" message={error} />}

      {!error && rows.length === 0 && (
        <EmptyState
          title="No audit events yet"
          description="Successful logins, denials, and sign-outs will appear here once Supabase is connected and activity occurs."
        />
      )}

      {!error && rows.length > 0 && (
        <DataTable<AuditEventRow>
          rows={rows}
          getRowKey={(row) => row.id}
          columns={[
            {
              key: "timestamp",
              header: "Time",
              render: (row) => new Date(row.timestamp).toLocaleString(),
            },
            {
              key: "action_type",
              header: "Action",
              render: (row) => (
                <Badge variant="muted">{row.action_type}</Badge>
              ),
            },
            {
              key: "entity",
              header: "Entity",
              render: (row) =>
                row.entity_type
                  ? `${row.entity_type}${row.entity_id ? ` · ${row.entity_id}` : ""}`
                  : "—",
            },
            {
              key: "source",
              header: "Source",
              render: (row) => row.source,
            },
            {
              key: "correlation_id",
              header: "Correlation",
              render: (row) => row.correlation_id ?? "—",
            },
          ]}
        />
      )}
    </div>
  );
}
