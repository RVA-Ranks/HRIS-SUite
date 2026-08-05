import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listFeatureFlags, type FeatureFlagRow } from "@/server/data/settings";

export default async function SettingsPage() {
  const { flags, allowlistCount, aiKillSwitch, fromSeed, error } =
    await listFeatureFlags();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Read-only Phase 1 view of feature flags and auth policy notes."
        actions={<Badge variant="muted">Read only</Badge>}
      />

      {error && (
        <ErrorState title="Partial settings load" message={error} />
      )}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Auth allowlist</h2>
        <p className="mt-2 text-sm text-slate-600">
          Sign-in is restricted to emails in{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            AUTH_ALLOWLIST_EMAILS
          </code>
          . Phase 1 assigns the administrator role to allowlisted users on first
          login.
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Configured allowlist entries:{" "}
          <span className="font-medium">{allowlistCount}</span>
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">AI Gateway</h2>
        <p className="mt-2 text-sm text-slate-600">
          Global kill switch:{" "}
          <Badge variant={aiKillSwitch ? "warning" : "success"}>
            {aiKillSwitch ? "ON (blocked)" : "OFF (may run when provisioned)"}
          </Badge>
        </p>
      </div>

      {fromSeed && (
        <div className="mb-4">
          <EmptyState
            title="Using default feature flags"
            description="Connect Supabase and apply the Phase 1 migration to load flags from the database."
          />
        </div>
      )}

      <DataTable<FeatureFlagRow>
        rows={flags}
        getRowKey={(row) => row.key}
        columns={[
          {
            key: "key",
            header: "Flag",
            render: (row) => (
              <code className="text-xs">{row.key}</code>
            ),
          },
          {
            key: "enabled",
            header: "Enabled",
            render: (row) => (
              <Badge variant={row.enabled ? "success" : "muted"}>
                {row.enabled ? "true" : "false"}
              </Badge>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (row) => row.description ?? "—",
          },
        ]}
      />
    </div>
  );
}
