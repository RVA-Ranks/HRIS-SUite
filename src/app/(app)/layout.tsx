import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import {
  getConfigurationErrorMessage,
  getConfigurationStatus,
} from "@/server/data/config-status";
import { getSessionUser } from "@/server/auth/require-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configStatus = getConfigurationStatus();

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

  const supabase = await createClient();
  if (!supabase) {
    redirect("/login?reason=configuration");
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const user = await getSessionUser();
  if (!user) {
    redirect("/denied");
  }

  return (
    <ToastProvider>
      <AppShell userEmail={user.email}>{children}</AppShell>
    </ToastProvider>
  );
}
