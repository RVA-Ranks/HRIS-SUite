import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  hasPermission,
  PERMISSION_KEYS,
  type PermissionKey,
} from "@/server/auth/permissions";

export type SessionUser = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string | null;
  permissions: string[];
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "unauthenticated" | "forbidden" | "configuration",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function loadUserPermissions(userId: string): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) {
    return [];
  }

  const { data: userRoles, error: userRolesError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (userRolesError || !userRoles?.length) {
    return [];
  }

  const roleIds = userRoles.map((row) => row.role_id);

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .in("role_id", roleIds);

  if (rolePermissionsError || !rolePermissions) {
    return [];
  }

  const permissions = new Set<string>();
  for (const row of rolePermissions) {
    const permission = row.permissions as { key?: string } | null;
    if (permission?.key) {
      permissions.add(permission.key);
    }
  }

  return Array.from(permissions);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, display_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const permissions = profile?.id
    ? await loadUserPermissions(profile.id)
    : [PERMISSION_KEYS.APP_ACCESS];

  return {
    id: profile?.id ?? user.id,
    authUserId: user.id,
    email: user.email,
    displayName: profile?.display_name ?? user.user_metadata?.full_name ?? null,
    permissions,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Authentication required.", "unauthenticated");
  }
  return user;
}

export async function requirePermission(
  permissionKey: PermissionKey,
): Promise<SessionUser> {
  const user = await requireUser();

  if (!hasPermission(user.permissions, permissionKey)) {
    throw new AuthError("Permission denied.", "forbidden");
  }

  return user;
}

export function getConfiguredAllowlist(): string[] {
  return getServerEnv().authAllowlistEmails;
}
