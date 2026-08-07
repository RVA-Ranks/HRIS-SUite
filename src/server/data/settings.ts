import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type FeatureFlagRow = {
  key: string;
  enabled: boolean;
  description: string | null;
};

const STATIC_FLAGS: FeatureFlagRow[] = [
  {
    key: "ai.global.enabled",
    enabled: false,
    description: "Master switch for AI Gateway use cases",
  },
  {
    key: "ai.gateway.smoke",
    enabled: false,
    description: "Smoke-test flag for AI Gateway connectivity",
  },
];

export async function listFeatureFlags(): Promise<{
  flags: FeatureFlagRow[];
  allowlistCount: number;
  aiKillSwitch: boolean;
  fromSeed: boolean;
  error?: string;
}> {
  const serverEnv = getServerEnv();
  const supabase = await createClient();

  if (!supabase) {
    return {
      flags: STATIC_FLAGS,
      allowlistCount: serverEnv.authAllowlistEmails.length,
      aiKillSwitch: serverEnv.aiGlobalKillSwitch,
      fromSeed: true,
    };
  }

  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled, description")
    .order("key", { ascending: true });

  if (error) {
    return {
      flags: STATIC_FLAGS,
      allowlistCount: serverEnv.authAllowlistEmails.length,
      aiKillSwitch: serverEnv.aiGlobalKillSwitch,
      fromSeed: true,
      error: error.message,
    };
  }

  return {
    flags: data?.length ? data : STATIC_FLAGS,
    allowlistCount: serverEnv.authAllowlistEmails.length,
    aiKillSwitch: serverEnv.aiGlobalKillSwitch,
    fromSeed: !data?.length,
  };
}
