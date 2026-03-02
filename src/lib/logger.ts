import { getRequestContext } from "@/lib/request-context";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId: string | undefined;
  actorUserId: string | null | undefined;
  route: string | undefined;
  metadata?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

function emit(
  level: LogLevel,
  event: string,
  metadata?: Record<string, unknown>,
  err?: unknown,
): void {
  const ctx = getRequestContext();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: ctx?.requestId,
    actorUserId: ctx?.actorUserId,
    route: ctx?.route,
    ...(metadata !== undefined && { metadata }),
  };

  if (err instanceof Error) {
    entry.error = { message: err.message, stack: err.stack };
  } else if (err !== undefined) {
    entry.error = { message: String(err) };
  }

  const line = JSON.stringify(entry);

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

export function logInfo(event: string, metadata?: Record<string, unknown>): void {
  emit("info", event, metadata);
}

export function logWarn(event: string, metadata?: Record<string, unknown>): void {
  emit("warn", event, metadata);
}

export function logError(event: string, metadata?: Record<string, unknown>, err?: unknown): void {
  emit("error", event, metadata, err);
}
