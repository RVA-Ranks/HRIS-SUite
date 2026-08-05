import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listIntegrationConnections,
  type IntegrationConnectionRow,
} from "@/server/data/integrations";

function statusVariant(
  status: string,
): "default" | "success" | "warning" | "danger" | "muted" {
  switch (status) {
    case "connected":
      return "success";
    case "disconnected":
      return "muted";
    case "error":
      return "danger";
    default:
      return "warning";
  }
}

export default async function IntegrationsPage() {
  const { rows, error, fromSeed } = await listIntegrationConnections();

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connection status for external systems. Phase 0B proofs remain separate from this shell."
        actions={
          fromSeed ? (
            <Badge variant="warning">Showing seed defaults</Badge>
          ) : (
            <Badge variant="success">Live from database</Badge>
          )
        }
      />

      {error && (
        <ErrorState
          title="Database unavailable — showing defaults"
          message={error}
        />
      )}

      {rows.every((row) => row.status === "disconnected") && (
        <div className="mb-4">
          <EmptyState
            title="All integrations disconnected"
            description="JazzHR, Gmail, Google Calendar, Google Drive, and Adobe Sign are seeded as disconnected until Phase 0B proofs and credentials are approved."
          />
        </div>
      )}

      <DataTable<IntegrationConnectionRow>
        rows={rows}
        getRowKey={(row) => row.id}
        columns={[
          {
            key: "provider",
            header: "Provider",
            render: (row) => row.provider,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
            ),
          },
          {
            key: "last_success_at",
            header: "Last success",
            render: (row) =>
              row.last_success_at
                ? new Date(row.last_success_at).toLocaleString()
                : "—",
          },
          {
            key: "last_error_code",
            header: "Last error",
            render: (row) => row.last_error_code ?? "—",
          },
        ]}
      />
    </div>
  );
}
