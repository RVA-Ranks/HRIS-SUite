import { ROLE_KEYS, type RoleKey } from "@/server/auth/permissions";

/** Mutually exclusive OAuth baseline roles. Exactly one may be assigned. */
export const EXCLUSIVE_BOOTSTRAP_ROLES = [
  ROLE_KEYS.ADMINISTRATOR,
  ROLE_KEYS.READ_ONLY,
  ROLE_KEYS.STAFF_SUBMITTER,
  ROLE_KEYS.HR_REVIEWER,
] as const;

export type ExclusiveBootstrapRole =
  (typeof EXCLUSIVE_BOOTSTRAP_ROLES)[number];

export type BootstrapRoleMapping = {
  adminEmails: string[];
  staffSubmitterEmails: string[];
  hrReviewerEmails: string[];
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailInList(email: string, list: string[]): boolean {
  const normalized = normalizeEmail(email);
  return list.some((entry) => entry.trim().toLowerCase() === normalized);
}

/**
 * Trusted server-side role resolution for OAuth bootstrap.
 * Never trust browser-supplied role keys. Priority:
 * administrator > staff_submitter > hr_reviewer > read_only (default).
 */
export function resolveBootstrapRole(
  email: string,
  mapping: BootstrapRoleMapping,
): ExclusiveBootstrapRole {
  if (emailInList(email, mapping.adminEmails)) {
    return ROLE_KEYS.ADMINISTRATOR;
  }
  if (emailInList(email, mapping.staffSubmitterEmails)) {
    return ROLE_KEYS.STAFF_SUBMITTER;
  }
  if (emailInList(email, mapping.hrReviewerEmails)) {
    return ROLE_KEYS.HR_REVIEWER;
  }
  return ROLE_KEYS.READ_ONLY;
}

export function isExclusiveBootstrapRole(
  roleKey: string,
): roleKey is ExclusiveBootstrapRole {
  return (EXCLUSIVE_BOOTSTRAP_ROLES as readonly string[]).includes(roleKey);
}

/** Type guard helper for RoleKey consumers. */
export function asRoleKey(role: ExclusiveBootstrapRole): RoleKey {
  return role;
}
