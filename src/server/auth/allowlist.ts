export function isEmailAllowlisted(
  email: string,
  allowlist: string[],
): boolean {
  const normalized = email.trim().toLowerCase();
  return allowlist.some((entry) => entry.trim().toLowerCase() === normalized);
}
