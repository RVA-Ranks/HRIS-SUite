import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export const CORRELATION_HEADER = "x-correlation-id";

export function createCorrelationId(): string {
  return uuidv4();
}

export async function getCorrelationId(): Promise<string> {
  try {
    const headerStore = await headers();
    const existing = headerStore.get(CORRELATION_HEADER);
    if (existing) {
      return existing;
    }
  } catch {
    // Outside a Next.js request scope (tests, scripts).
  }
  return createCorrelationId();
}

export function setCorrelationIdHeader(
  requestHeaders: Headers,
  correlationId: string,
): Headers {
  const nextHeaders = new Headers(requestHeaders);
  nextHeaders.set(CORRELATION_HEADER, correlationId);
  return nextHeaders;
}
