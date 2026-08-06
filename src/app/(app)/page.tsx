import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getEnvStatus } from "@/lib/env";
import { PERMISSION_KEYS } from "@/server/auth/permissions";
import { redirectForAuthError } from "@/server/auth/redirect";
import { requirePermission } from "@/server/auth/require-user";

export default async function CommandCenterPage() {
  try {
    await requirePermission(PERMISSION_KEYS.APP_ACCESS);
  } catch (error) {
    redirectForAuthError(error);
  }

  const envStatus = getEnvStatus();

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Operational overview for the secure platform foundation. Modules appear here as they are implemented."
        actions={
          <Badge variant={envStatus === "configured" ? "success" : "warning"}>
            Env {envStatus}
          </Badge>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState
          title="No operational modules yet"
          description="Phase 1 delivers auth, audit, job run visibility, integration status, and settings. Recruiting and JazzHR workflows are intentionally not shown here."
        />
        <EmptyState
          title="Trigger.dev not connected"
          description="Durable workers are documented (Pattern C) but not wired in Phase 1. Job runs will remain empty until Trigger.dev is provisioned."
        />
      </div>
    </div>
  );
}
