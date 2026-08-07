const TRUSTED_ORIGIN = "https://internal.invalid";

/**
 * Restrict post-login redirects to same-origin relative paths.
 * Blocks protocol-relative URLs, open redirects, absolute URLs,
 * backslash tricks, and percent-encoded backslashes.
 */
export function safeInternalPath(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    /%5c/i.test(next) ||
    /[\u0000-\u001F\u007F]/.test(next)
  ) {
    return "/";
  }

  try {
    const parsed = new URL(next, TRUSTED_ORIGIN);
    if (parsed.origin !== TRUSTED_ORIGIN) {
      return "/";
    }
    const result = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      result.includes("\\") ||
      result.startsWith("//") ||
      /%5c/i.test(result)
    ) {
      return "/";
    }
    return result;
  } catch {
    return "/";
  }
}
