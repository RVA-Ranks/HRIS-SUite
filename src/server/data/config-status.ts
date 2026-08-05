import { isAuthAllowlistConfigured, isSupabaseConfigured } from "@/lib/env";

export type ConfigurationStatus = {
  supabaseConfigured: boolean;
  allowlistConfigured: boolean;
  ready: boolean;
};

export function getConfigurationStatus(): ConfigurationStatus {
  const supabaseConfigured = isSupabaseConfigured();
  const allowlistConfigured = isAuthAllowlistConfigured();

  return {
    supabaseConfigured,
    allowlistConfigured,
    ready: supabaseConfigured && allowlistConfigured,
  };
}

export function getConfigurationErrorMessage(status: ConfigurationStatus): string {
  if (status.ready) {
    return "";
  }

  const missing: string[] = [];
  if (!status.supabaseConfigured) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!status.allowlistConfigured) {
    missing.push("AUTH_ALLOWLIST_EMAILS");
  }

  return `Configuration incomplete. Set ${missing.join(" and ")} in your environment.`;
}
