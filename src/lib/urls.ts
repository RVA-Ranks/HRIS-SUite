/**
 * Restrict post-login redirects to same-origin relative paths.
 * Blocks protocol-relative URLs, open redirects, and absolute URLs.
 */
export function safeInternalPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("://")
  ) {
    return "/";
  }
  return next;
}
