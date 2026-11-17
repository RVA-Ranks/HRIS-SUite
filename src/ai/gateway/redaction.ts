const SECRET_PATTERNS = [
  /\b(sk-[a-zA-Z0-9]{10,})\b/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+/gi,
];

export function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === "object") {
    return redactInput(value as Record<string, unknown>);
  }

  return value;
}

export function redactInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    result[key] = redactValue(value);
  }

  return result;
}
