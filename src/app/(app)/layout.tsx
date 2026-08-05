import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { getConfigurationErrorMessage, getConfigurationStatus } from "@/server/data/config-status";
import { getSessionUser } from "@/server/auth/require-user";
import { ErrorState } from "@/components/ui/ErrorState";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configStatus = getConfigurationStatus();
  const user = configStatus.ready ? await getSessionUser() : null;

  if (!configStatus.ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
        <ErrorState
          title="Configuration required"
          message={getConfigurationErrorMessage(configStatus)}
        />
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppShell userEmail={user?.email}>{children}</AppShell>
    </ToastProvider>
  );
}
