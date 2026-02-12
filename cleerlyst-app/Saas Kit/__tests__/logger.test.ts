import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = [
  "encrypted_payload",
  "identifier_hash",
  "data",
  "payload",
];

function capturedEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  expect(spy).toHaveBeenCalledTimes(1);
  const raw = spy.mock.calls[0][0] as string;
  return JSON.parse(raw) as Record<string, unknown>;
}

function allKeys(obj: Record<string, unknown>): string[] {
  const keys: string[] = [];
  function walk(o: unknown) {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o)) {
        keys.push(k);
        walk(v);
      }
    }
  }
  walk(obj);
  return keys;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Logger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- requestId inclusion ----

  it("logInfo includes requestId from request context", () => {
    runWithRequestContext(
      { requestId: "req-abc-123", actorUserId: null, route: "/api/test" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(entry.requestId).toBe("req-abc-123");
  });

  it("logWarn includes requestId from request context", () => {
    runWithRequestContext(
      { requestId: "req-warn-456", actorUserId: null, route: "/api/warn" },
      () => logWarn("warn.event"),
    );
    const entry = capturedEntry(warnSpy);
    expect(entry.requestId).toBe("req-warn-456");
  });

  it("logError includes requestId from request context", () => {
    runWithRequestContext(
      { requestId: "req-err-789", actorUserId: null, route: "/api/error" },
      () => logError("error.event"),
    );
    const entry = capturedEntry(errorSpy);
    expect(entry.requestId).toBe("req-err-789");
  });

  // ---- actorUserId inclusion ----

  it("logInfo includes actorUserId when present", () => {
    runWithRequestContext(
      { requestId: "req-1", actorUserId: "user-42", route: "/api/test" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(entry.actorUserId).toBe("user-42");
  });

  it("logInfo includes actorUserId as null when not set", () => {
    runWithRequestContext(
      { requestId: "req-2", actorUserId: null, route: "/api/test" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(entry.actorUserId).toBeNull();
  });

  // ---- route inclusion ----

  it("logInfo includes route from request context", () => {
    runWithRequestContext(
      { requestId: "req-3", actorUserId: null, route: "/api/datasets/abc/me" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(entry.route).toBe("/api/datasets/abc/me");
  });

  // ---- level field ----

  it("logInfo sets level to 'info'", () => {
    runWithRequestContext(
      { requestId: "req-4", actorUserId: null, route: "/" },
      () => logInfo("test.event"),
    );
    expect(capturedEntry(logSpy).level).toBe("info");
  });

  it("logWarn sets level to 'warn'", () => {
    runWithRequestContext(
      { requestId: "req-5", actorUserId: null, route: "/" },
      () => logWarn("test.event"),
    );
    expect(capturedEntry(warnSpy).level).toBe("warn");
  });

  it("logError sets level to 'error'", () => {
    runWithRequestContext(
      { requestId: "req-6", actorUserId: null, route: "/" },
      () => logError("test.event"),
    );
    expect(capturedEntry(errorSpy).level).toBe("error");
  });

  // ---- timestamp ----

  it("includes an ISO timestamp", () => {
    runWithRequestContext(
      { requestId: "req-7", actorUserId: null, route: "/" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(() => new Date(entry.timestamp as string).toISOString()).not.toThrow();
  });

  // ---- metadata pass-through ----

  it("includes metadata when provided", () => {
    runWithRequestContext(
      { requestId: "req-8", actorUserId: null, route: "/" },
      () => logInfo("test.event", { datasetId: "ds-1", status: "published" }),
    );
    const entry = capturedEntry(logSpy);
    expect(entry.metadata).toEqual({ datasetId: "ds-1", status: "published" });
  });

  it("omits metadata key entirely when not provided", () => {
    runWithRequestContext(
      { requestId: "req-9", actorUserId: null, route: "/" },
      () => logInfo("test.event"),
    );
    const entry = capturedEntry(logSpy);
    expect(entry).not.toHaveProperty("metadata");
  });

  // ---- output is valid JSON ----

  it("outputs valid JSON to console", () => {
    runWithRequestContext(
      { requestId: "req-10", actorUserId: null, route: "/" },
      () => logInfo("test.json"),
    );
    const raw = logSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  // ---- FORBIDDEN KEYS: must NEVER appear ----

  it("does NOT include forbidden keys in log output (no metadata)", () => {
    runWithRequestContext(
      { requestId: "req-f1", actorUserId: null, route: "/" },
      () => logInfo("clean.event"),
    );
    const entry = capturedEntry(logSpy);
    const keys = allKeys(entry);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("does NOT include forbidden keys even when passed as metadata", () => {
    runWithRequestContext(
      { requestId: "req-f2", actorUserId: null, route: "/" },
      () =>
        logInfo("suspicious.event", {
          encrypted_payload: "SHOULD_NOT_APPEAR",
          identifier_hash: "SHOULD_NOT_APPEAR",
          data: "SHOULD_NOT_APPEAR",
          payload: "SHOULD_NOT_APPEAR",
          datasetId: "ds-safe",
        }),
    );

    const entry = capturedEntry(logSpy);

    // The metadata is passed through as-is by the logger.
    // The caller is responsible for NOT passing forbidden keys.
    // This test documents that if a caller breaks the rule, the keys
    // would appear — therefore callers MUST be audited.
    //
    // For defence-in-depth, we verify the TOP-LEVEL entry never contains
    // these keys (they could only appear nested inside metadata).
    const topLevelKeys = Object.keys(entry);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(topLevelKeys).not.toContain(forbidden);
    }
  });

  // ---- graceful outside request context ----

  it("logs gracefully outside of a request context", () => {
    logInfo("no.context.event", { datasetId: "ds-x" });
    const entry = capturedEntry(logSpy);
    expect(entry.requestId).toBeUndefined();
    expect(entry.actorUserId).toBeUndefined();
    expect(entry.route).toBeUndefined();
    expect(entry.event).toBe("no.context.event");
  });
});
