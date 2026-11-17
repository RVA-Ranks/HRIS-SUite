import { getServerEnv, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowlisted } from "@/server/auth/allowlist";
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

/**
 * Fail-closed permission load. Any query error → empty list (caller treats as deny).
 */
async function loadUserPermissions(userId: string): Promise<string[] | null> {
  const supabase = await createClient();
  if (!supabase) {
    return null;
  }

  const { data: userRoles, error: userRolesError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);

  if (userRolesError) {
    return null;
  }

  if (!userRoles?.length) {
    return [];
  }

  const roleIds = userRoles.map((row) => row.role_id);

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .in("role_id", roleIds);

  if (rolePermissionsError) {
    return null;
  }

  if (!rolePermissions) {
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

/**
 * Fail-closed session resolution.
 * Missing profile, query errors, empty permissions, or missing app.access → null.
 * No APP_ACCESS fallback for users without a DB profile.
 */
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

  const allowlist = getServerEnv().authAllowlistEmails;
  if (!isEmailAllowlisted(user.email, allowlist)) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, display_name, status")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (profileError || !profile?.id) {
    return null;
  }

  const permissions = await loadUserPermissions(profile.id);
  if (permissions === null) {
    return null;
  }

  if (
    permissions.length === 0 ||
    !permissions.includes(PERMISSION_KEYS.APP_ACCESS)
  ) {
    return null;
  }

  return {
    id: profile.id,
    authUserId: user.id,
    email: user.email,
    displayName: profile.display_name ?? user.user_metadata?.full_name ?? null,
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

export async function requireAnyPermission(
  permissionKeys: PermissionKey[],
): Promise<SessionUser> {
  const user = await requireUser();

  if (!permissionKeys.some((key) => hasPermission(user.permissions, key))) {
    throw new AuthError("Permission denied.", "forbidden");
  }

  return user;
}

export function getConfiguredAllowlist(): string[] {
  return getServerEnv().authAllowlistEmails;
}

export function getConfiguredAdminEmails(): string[] {
  return getServerEnv().authAdminEmails;
}
