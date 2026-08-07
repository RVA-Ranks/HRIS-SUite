import { z } from "zod";

const truthy = new Set(["true", "1", "yes", "on"]);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }
  return truthy.has(value.trim().toLowerCase());
}

function parseEmailList(value: string | undefined): string[] {
  if (!value || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

const serverEnvSchema = z.object({
  AUTH_ALLOWLIST_EMAILS: z.string().optional(),
  AUTH_ADMIN_EMAILS: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_PROJECT_ID: z.string().optional(),
  AI_GLOBAL_KILL_SWITCH: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = {
  /** Login eligibility — who may complete OAuth into the app. */
  authAllowlistEmails: string[];
  /** Initial administrator bootstrap only — must also be on the allowlist. */
  authAdminEmails: string[];
  openaiApiKey?: string;
  openaiProjectId?: string;
  aiGlobalKillSwitch: boolean;
  supabaseServiceRoleKey?: string;
};

export type EnvStatus = "configured" | "partial";

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) {
    return cachedPublicEnv;
  }

  cachedPublicEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  serverEnvSchema.parse({
    AUTH_ALLOWLIST_EMAILS: process.env.AUTH_ALLOWLIST_EMAILS,
    AUTH_ADMIN_EMAILS: process.env.AUTH_ADMIN_EMAILS,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_PROJECT_ID: process.env.OPENAI_PROJECT_ID,
    AI_GLOBAL_KILL_SWITCH: process.env.AI_GLOBAL_KILL_SWITCH,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  cachedServerEnv = {
    authAllowlistEmails: parseEmailList(process.env.AUTH_ALLOWLIST_EMAILS),
    authAdminEmails: parseEmailList(process.env.AUTH_ADMIN_EMAILS),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiProjectId: process.env.OPENAI_PROJECT_ID,
    aiGlobalKillSwitch: parseBoolean(process.env.AI_GLOBAL_KILL_SWITCH, true),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  return cachedServerEnv;
}

export function isSupabaseConfigured(): boolean {
  const env = getPublicEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isAuthAllowlistConfigured(): boolean {
  return getServerEnv().authAllowlistEmails.length > 0;
}

export function getEnvStatus(): EnvStatus {
  if (isSupabaseConfigured() && isAuthAllowlistConfigured()) {
    return "configured";
  }
  return "partial";
}

export function requireRuntimeAuthEnv(): {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authAllowlistEmails: string[];
  authAdminEmails: string[];
} {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL and anon key are required for runtime auth.");
  }

  if (serverEnv.authAllowlistEmails.length === 0) {
    throw new Error("AUTH_ALLOWLIST_EMAILS is required for runtime auth.");
  }

  return {
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    authAllowlistEmails: serverEnv.authAllowlistEmails,
    authAdminEmails: serverEnv.authAdminEmails,
  };
}

export function resetEnvCacheForTests(): void {
  cachedPublicEnv = null;
  cachedServerEnv = null;
}
