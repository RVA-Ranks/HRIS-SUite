export const ROLE_KEYS = {
  ADMINISTRATOR: "administrator",
  HR_ADMIN: "hr_admin",
  MANAGER: "manager",
  EXECUTIVE_APPROVER: "executive_approver",
  READ_ONLY: "read_only",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const PERMISSION_KEYS = {
  APP_ACCESS: "app.access",
  AUDIT_READ: "audit.read",
  JOBS_READ: "jobs.read",
  INTEGRATIONS_READ: "integrations.read",
  SETTINGS_WRITE: "settings.write",
  AI_USE: "ai.use",
} as const;

export type PermissionKey =
  (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export function hasPermission(
  userPermissions: string[],
  permissionKey: string,
): boolean {
  return userPermissions.includes(permissionKey);
}

export function hasAnyPermission(
  userPermissions: string[],
  permissionKeys: string[],
): boolean {
  return permissionKeys.some((key) => hasPermission(userPermissions, key));
}
