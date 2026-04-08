import { NextRequest, NextResponse } from "next/server";
import {
  getDatasetById,
  getInstituteById,
  insertRecordsBatch,
  insertAuditLog,
  type RecordInsertRow,
} from "@/lib/database";
import { hashIdentifier } from "@/lib/identifier";
import { encryptPayload, toBuffer } from "@/lib/encryption";
import { parseFile, type ParsedRow } from "@/lib/file-parser";
import { logInfo, logError } from "@/lib/logger";
import { withApiHandler, type HandlerSession } from "@/lib/api-handler";
import {
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  rateLimited,
  internalError,
} from "@/lib/errors";
import { rateLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/upload
// ---------------------------------------------------------------------------
//
// Accepts multipart/form-data:
//   file              — CSV or XLSX file
//   datasetId         — UUID of the target dataset
//   identifierColumn  — column name in the file used as the identifier
//
// Processing:
//   1. Verify admin session + institute ownership
//   2. Enforce draft-only upload
//   3. Enforce single upload per dataset — schema lock
//   4. Parse file entirely in memory (never touches disk)
//   5. Canonicalize headers, exclude identifier column
//   6. Hash identifiers, detect in-file duplicates
//   7. Encrypt payloads
//   8. Batch-insert rows + persist headers in single TX
//   9. ON CONFLICT DO NOTHING with mismatch detection
//  10. Audit log (counts only, never row data)
//
// Returns only { inserted, skipped } — NEVER the rows themselves.
// ---------------------------------------------------------------------------

async function handler(
  request: NextRequest,
  session: HandlerSession | null,
) {
  if (!session) throw unauthorized();
  if (session.user.role !== "admin") throw forbidden("Admin access required");

  const adminUserId = session.user.id;
  const adminInstituteId = session.user.instituteId;

  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const allowed = await rateLimiter.check(
    `admin-upload:${adminUserId}:${ip}`,
    10,
    60_000,
  );
  if (!allowed) throw rateLimited();

  // ----- Parse multipart form data -----

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw badRequest("Invalid multipart form data", "INVALID_FORM_DATA");
  }

  const file = formData.get("file");
  const datasetId = formData.get("datasetId");
  const identifierColumnRaw = formData.get("identifierColumn");

  if (!(file instanceof File)) {
    throw badRequest("Missing file", "MISSING_FILE");
  }
  if (typeof datasetId !== "string" || !datasetId.trim()) {
    throw badRequest("Missing datasetId", "MISSING_DATASET_ID");
  }

  const identifierColumn =
    typeof identifierColumnRaw === "string"
      ? identifierColumnRaw.trim()
      : "";

  if (file.size > MAX_FILE_SIZE) {
    throw badRequest(
      `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      "FILE_TOO_LARGE",
    );
  }

  // ----- Validate dataset + institute ownership -----

  const dataset = await getDatasetById(datasetId.trim());
  if (!dataset) throw notFound("Dataset not found");

  if (dataset.institute_id !== adminInstituteId) {
    throw forbidden("Dataset does not belong to your institute");
  }

  // ----- Enforce draft-only upload -----

  if (dataset.status !== "draft") {
    await insertAuditLog(adminUserId, "dataset.upload.blocked", dataset.id, {
      reason: "upload_locked",
      status: dataset.status,
    }).catch(() => {});
    throw badRequest("upload_locked", "UPLOAD_LOCKED");
  }

  // ----- Enforce single upload per dataset (schema lock) -----

  const existingHeaders = Array.isArray(dataset.headers) ? dataset.headers : [];
  if (existingHeaders.length > 0) {
    await insertAuditLog(adminUserId, "dataset.upload.blocked", dataset.id, {
      reason: "dataset_schema_locked",
    }).catch(() => {});
    throw badRequest("dataset_schema_locked", "SCHEMA_LOCKED");
  }

  const isPublic = dataset.audience_type === "public";

  // ----- Public dataset hard guards -----

  if (isPublic && dataset.identifier_type !== null) {
    throw badRequest(
      "public_dataset_cannot_require_identifier",
      "PUBLIC_DATASET_CANNOT_REQUIRE_IDENTIFIER",
    );
  }

  if (!isPublic && !identifierColumn) {
    throw badRequest("Missing identifierColumn", "MISSING_IDENTIFIER_COLUMN");
  }

  const institute = await getInstituteById(dataset.institute_id);
  if (!institute) throw internalError("Institute not found");

  // ----- Read file into memory, parse, then destroy buffer -----

  let rawBuffer: ArrayBuffer | null = await file.arrayBuffer();
  let parsed: { headers: string[]; rows: ParsedRow[] };

  try {
    parsed = parseFile(rawBuffer, file.type || file.name);
  } catch (err) {
    rawBuffer = null;
    throw badRequest(
      err instanceof Error ? err.message : "File parse error",
      "FILE_PARSE_ERROR",
    );
  }

  rawBuffer = null;

  if (parsed.rows.length === 0) {
    throw badRequest("File contains no data rows", "EMPTY_FILE");
  }

  // ===== PUBLIC DATASET PATH =====

  if (isPublic) {
    if (parsed.rows.length !== 1) {
      throw badRequest(
        "public_dataset_must_have_single_row",
        "PUBLIC_DATASET_MUST_HAVE_SINGLE_ROW",
      );
    }

    if (identifierColumn && parsed.headers.includes(identifierColumn)) {
      throw badRequest(
        "public_dataset_cannot_have_identifier_column",
        "PUBLIC_DATASET_CANNOT_HAVE_IDENTIFIER_COLUMN",
      );
    }

    const canonicalHeaders = parsed.headers
      .map((h) => h.trim())
      .filter(Boolean);

    const row = parsed.rows[0];
    const payload: Record<string, string> = {};
    for (const key of parsed.headers) {
      payload[key] = row[key] ?? "";
    }

    const encrypted = encryptPayload(payload);
    const payloadBuffer = toBuffer(encrypted);

    const insertRows: RecordInsertRow[] = [
      { identifierHash: "__public__", encryptedPayload: payloadBuffer },
    ];

    parsed.rows.length = 0;

    let inserted: number;
    try {
      inserted = await insertRecordsBatch(dataset.id, insertRows, canonicalHeaders);
    } catch (err) {
      logError("dataset.upload.insert_error", { datasetId: dataset.id }, err);
      throw internalError("Database insert failed — no records were saved");
    }

    try {
      await insertAuditLog(adminUserId, "dataset.records_uploaded", dataset.id, {
        inserted,
        skipped: 0,
        headerCount: canonicalHeaders.length,
        audience_type: "public",
        fileName: file.name,
        fileSizeBytes: file.size,
      });
    } catch (err) {
      logError("dataset.upload.audit_error", { datasetId: dataset.id }, err);
    }

    logInfo("dataset.upload.success", {
      datasetId: dataset.id,
      inserted,
      skipped: 0,
      headerCount: canonicalHeaders.length,
      audience_type: "public",
    });

    return NextResponse.json({ success: true, inserted, skipped: 0 });
  }

  // ===== RESTRICTED DATASET PATH =====

  const colName = identifierColumn;
  if (!parsed.headers.includes(colName)) {
    throw badRequest(
      `Column "${colName}" not found in file. Available columns: ${parsed.headers.join(", ")}`,
      "IDENTIFIER_COLUMN_NOT_FOUND",
    );
  }

  const canonicalHeaders = parsed.headers
    .map((h) => h.trim())
    .filter(Boolean)
    .filter((h) => h !== colName);

  const insertRows: RecordInsertRow[] = [];
  const seenHashes = new Set<string>();
  let skipped = 0;

  for (const row of parsed.rows) {
    const identifierValue = row[colName];

    if (!identifierValue || identifierValue.trim() === "") {
      skipped++;
      continue;
    }

    const identHash = hashIdentifier(identifierValue.trim(), institute.id);

    if (seenHashes.has(identHash)) {
      throw badRequest(
        "duplicate_identifiers_in_file",
        "DUPLICATE_IDENTIFIERS_IN_FILE",
      );
    }
    seenHashes.add(identHash);

    const payload: Record<string, string> = {};
    for (const key of parsed.headers) {
      if (key !== colName) {
        payload[key] = row[key] ?? "";
      }
    }

    const encrypted = encryptPayload(payload);
    const payloadBuffer = toBuffer(encrypted);

    insertRows.push({
      identifierHash: identHash,
      encryptedPayload: payloadBuffer,
    });
  }

  parsed.rows.length = 0;

  if (insertRows.length === 0) {
    throw badRequest(
      "No valid rows to insert (all identifiers were empty)",
      "NO_VALID_ROWS",
    );
  }

  // ----- Batch insert + persist headers (single TX) -----

  let inserted: number;
  try {
    inserted = await insertRecordsBatch(dataset.id, insertRows, canonicalHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message === "duplicate_identifiers_in_dataset") {
      throw badRequest(
        "duplicate_identifiers_in_dataset",
        "DUPLICATE_IDENTIFIERS_IN_DATASET",
      );
    }

    logError("dataset.upload.insert_error", { datasetId: dataset.id }, err);
    throw internalError("Database insert failed — no records were saved");
  }

  // ----- Audit log (counts only — NEVER row data) -----

  try {
    await insertAuditLog(adminUserId, "dataset.records_uploaded", dataset.id, {
      inserted,
      skipped,
      headerCount: canonicalHeaders.length,
      identifierColumn: colName,
      fileName: file.name,
      fileSizeBytes: file.size,
    });
  } catch (err) {
    logError("dataset.upload.audit_error", { datasetId: dataset.id }, err);
  }

  logInfo("dataset.upload.success", {
    datasetId: dataset.id,
    inserted,
    skipped,
    headerCount: canonicalHeaders.length,
  });

  return NextResponse.json({ success: true, inserted, skipped });
}

export const POST = withApiHandler(handler);
