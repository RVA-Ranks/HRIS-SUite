export const ROLE_KEYS = {
  ADMINISTRATOR: "administrator",
  HR_ADMIN: "hr_admin",
  MANAGER: "manager",
  EXECUTIVE_APPROVER: "executive_approver",
  READ_ONLY: "read_only",
  /** Restricted Phase 2 open-item submitter — never paired with read_only. */
  STAFF_SUBMITTER: "staff_submitter",
  /** Restricted Phase 2 open-item reviewer — never paired with read_only. */
  HR_REVIEWER: "hr_reviewer",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const PERMISSION_KEYS = {
  APP_ACCESS: "app.access",
  AUDIT_READ: "audit.read",
  JOBS_READ: "jobs.read",
  INTEGRATIONS_READ: "integrations.read",
  SETTINGS_READ: "settings.read",
  SETTINGS_WRITE: "settings.write",
  AI_USE: "ai.use",
  /** Phase 2 — not granted to legacy read_only */
  TASKS_CREATE_OWN: "tasks.create_own",
  TASKS_READ_OWN: "tasks.read_own",
  TASKS_COMMENT_OWN: "tasks.comment_own",
  TASKS_READ_ASSIGNED: "tasks.read_assigned",
  TASKS_ASSIGN: "tasks.assign",
  TASKS_MANAGE: "tasks.manage",
  TASKS_READ_RESTRICTED: "tasks.read_restricted",
  DOCUMENTS_UPLOAD_OWN: "documents.upload_own",
  DOCUMENTS_READ_PERMITTED: "documents.read_permitted",
  APPROVALS_REVIEW: "approvals.review",
  POSITIONS_MANAGE: "positions.manage",
  POSITIONS_READ: "positions.read",
  COMPENSATION_READ: "compensation.read",
  ORG_MEMBERSHIP_READ: "org.membership.read",
} as const;

/** Permissions that must never be granted to Phase 1 read_only via Phase 2 seeds. */
export const PHASE2_PERMISSION_KEYS = [
  PERMISSION_KEYS.TASKS_CREATE_OWN,
  PERMISSION_KEYS.TASKS_READ_OWN,
  PERMISSION_KEYS.TASKS_COMMENT_OWN,
  PERMISSION_KEYS.TASKS_READ_ASSIGNED,
  PERMISSION_KEYS.TASKS_ASSIGN,
  PERMISSION_KEYS.TASKS_MANAGE,
  PERMISSION_KEYS.TASKS_READ_RESTRICTED,
  PERMISSION_KEYS.DOCUMENTS_UPLOAD_OWN,
  PERMISSION_KEYS.DOCUMENTS_READ_PERMITTED,
  PERMISSION_KEYS.APPROVALS_REVIEW,
  PERMISSION_KEYS.POSITIONS_MANAGE,
  PERMISSION_KEYS.POSITIONS_READ,
  PERMISSION_KEYS.COMPENSATION_READ,
  PERMISSION_KEYS.ORG_MEMBERSHIP_READ,
] as const;

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
