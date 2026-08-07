type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SECRET_KEY_PATTERN =
  /(api[_-]?key|secret|password|token|authorization|bearer|service[_-]?role)/i;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/;

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERN.test(key)) {
      return "[REDACTED]";
    }
    if (SSN_PATTERN.test(value)) {
      return "[REDACTED]";
    }
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(String(index), item));
  }

  if (value && typeof value === "object") {
    return sanitizeContext(value as LogContext);
  }

  return value;
}

function sanitizeContext(context: LogContext): LogContext {
  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    sanitized[key] = sanitizeValue(key, value);
  }
  return sanitized;
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: sanitizeContext(context) } : {}),
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    write("debug", message, context);
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
};
