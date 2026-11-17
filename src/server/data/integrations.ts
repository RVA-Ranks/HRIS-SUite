import { createClient } from "@/lib/supabase/server";

export type IntegrationConnectionRow = {
  id: string;
  provider: string;
  status: string;
  last_success_at: string | null;
  last_error_code: string | null;
};

const STATIC_DISCONNECTED: IntegrationConnectionRow[] = [
  {
    id: "seed-jazzhr",
    provider: "jazzhr",
    status: "disconnected",
    last_success_at: null,
    last_error_code: null,
  },
  {
    id: "seed-gmail",
    provider: "gmail",
    status: "disconnected",
    last_success_at: null,
    last_error_code: null,
  },
  {
    id: "seed-google_calendar",
    provider: "google_calendar",
    status: "disconnected",
    last_success_at: null,
    last_error_code: null,
  },
  {
    id: "seed-google_drive",
    provider: "google_drive",
    status: "disconnected",
    last_success_at: null,
    last_error_code: null,
  },
  {
    id: "seed-adobe_sign",
    provider: "adobe_sign",
    status: "disconnected",
    last_success_at: null,
    last_error_code: null,
  },
];

export async function listIntegrationConnections(): Promise<{
  rows: IntegrationConnectionRow[];
  error?: string;
  fromSeed: boolean;
}> {
  const supabase = await createClient();
  if (!supabase) {
    return { rows: STATIC_DISCONNECTED, fromSeed: true };
  }

  const { data, error } = await supabase
    .from("integration_connections")
    .select("id, provider, status, last_success_at, last_error_code")
    .order("provider", { ascending: true });

  if (error) {
    return { rows: STATIC_DISCONNECTED, error: error.message, fromSeed: true };
  }

  if (!data?.length) {
    return { rows: STATIC_DISCONNECTED, fromSeed: true };
  }

  return { rows: data, fromSeed: false };
}
