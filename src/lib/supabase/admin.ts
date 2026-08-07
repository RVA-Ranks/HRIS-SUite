import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";

/**
 * Exception-only privileged Supabase client (service role).
 *
 * Authorized Phase 1 uses:
 * - OAuth bootstrap RPC (bootstrap_oauth_user)
 * - Denied-login and login audit writes under RLS
 * - Metadata-only AI run inserts when the session client cannot write
 *
 * Never import this module from client components, or from Trigger.dev workers
 * by default (prefer Pattern C). Never expose the service role key to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required for the admin client.");
  }

  if (!serverEnv.supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for the admin client.",
    );
  }

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

/** Returns null when the service role key is not configured (no throw). */
export function createAdminClientOrNull(): SupabaseClient | null {
  const serverEnv = getServerEnv();
  if (!serverEnv.supabaseServiceRoleKey) {
    return null;
  }

  try {
    return createAdminClient();
  } catch {
    return null;
  }
}
