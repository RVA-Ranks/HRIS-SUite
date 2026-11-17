"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
