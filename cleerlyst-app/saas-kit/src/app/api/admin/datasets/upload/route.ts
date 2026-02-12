import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDatasetById,
  getInstituteById,
  insertRecordsBatch,
  insertAuditLog,
  type RecordInsertRow,
} from "@/lib/database";
import { hashIdentifier } from "@/lib/hash";
import { encryptPayload, toBuffer } from "@/lib/encryption";
import { parseFile, type ParsedRow } from "@/lib/file-parser";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// Max file size: 10 MB
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
//   2. Enforce draft-only upload (PROMPT 3)
//   3. Enforce single upload per dataset — schema lock (PROMPT 4)
//   4. Parse file entirely in memory (never touches disk)
//   5. Canonicalize headers, exclude identifier column (PROMPT 7)
//   6. Hash identifiers, detect in-file duplicates (PROMPT 5)
//   7. Encrypt payloads
//   8. Batch-insert rows + persist headers in single TX (PROMPT 6)
//   9. ON CONFLICT DO NOTHING with mismatch detection (PROMPT 8)
//  10. Audit log (counts only, never row data)
//
// Returns only { inserted, skipped } — NEVER the rows themselves.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/admin/datasets/upload" },
    async () => {
      // ----- 1. Admin authentication -----

      if (!session?.user?.id || session.user.role !== "admin") {
        logWarn("dataset.upload.forbidden", { reason: "not_admin" });
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }

      const adminUserId = session.user.id;
      const adminInstituteId = session.user.instituteId;

      // ----- 2. Parse multipart form data -----

      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return NextResponse.json(
          { error: "Invalid multipart form data" },
          { status: 400 },
        );
      }

      const file = formData.get("file");
      const datasetId = formData.get("datasetId");
      const identifierColumn = formData.get("identifierColumn");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }
      if (typeof datasetId !== "string" || !datasetId.trim()) {
        return NextResponse.json({ error: "Missing datasetId" }, { status: 400 });
      }
      if (typeof identifierColumn !== "string" || !identifierColumn.trim()) {
        return NextResponse.json(
          { error: "Missing identifierColumn" },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB` },
          { status: 400 },
        );
      }

      // ----- 3. Validate dataset + institute ownership -----

      const dataset = await getDatasetById(datasetId.trim());
      if (!dataset) {
        return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      }

      if (dataset.institute_id !== adminInstituteId) {
        logWarn("dataset.upload.forbidden", { datasetId: datasetId.trim(), reason: "wrong_institute" });
        return NextResponse.json(
          { error: "Dataset does not belong to your institute" },
          { status: 403 },
        );
      }

      // ----- 4. PROMPT 3: Enforce draft-only upload -----
      //
      // Only draft datasets accept uploads.
      // Published and revoked datasets are permanently locked.

      if (dataset.status !== "draft") {
        logWarn("dataset.upload.rejected", {
          datasetId: datasetId.trim(),
          reason: "upload_locked",
          status: dataset.status,
        });
        await insertAuditLog(adminUserId, "dataset.upload.blocked", dataset.id, {
          reason: "upload_locked",
          status: dataset.status,
        }).catch(() => {});
        return NextResponse.json({ error: "upload_locked" }, { status: 400 });
      }

      // ----- 5. PROMPT 4: Enforce single upload per dataset (schema lock) -----
      //
      // If headers are already populated, the schema is locked.
      // A second upload to the same dataset is forbidden.

      const existingHeaders = Array.isArray(dataset.headers) ? dataset.headers : [];
      if (existingHeaders.length > 0) {
        logWarn("dataset.upload.schema_locked", { datasetId: datasetId.trim() });
        await insertAuditLog(adminUserId, "dataset.upload.blocked", dataset.id, {
          reason: "dataset_schema_locked",
        }).catch(() => {});
        return NextResponse.json({ error: "dataset_schema_locked" }, { status: 400 });
      }

      // Fetch institute for the salt (institute.id is the salt)
      const institute = await getInstituteById(dataset.institute_id);
      if (!institute) {
        return NextResponse.json(
          { error: "Institute not found" },
          { status: 500 },
        );
      }

      // ----- 6. Read file into memory, parse, then destroy buffer -----

      let rawBuffer: ArrayBuffer | null = await file.arrayBuffer();
      let parsed: { headers: string[]; rows: ParsedRow[] };

      try {
        parsed = parseFile(rawBuffer, file.type || file.name);
      } catch (err) {
        rawBuffer = null; // destroy
        const message = err instanceof Error ? err.message : "File parse error";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // Destroy the raw file buffer — plaintext data must not linger
      rawBuffer = null;

      // ----- 7. Validate identifier column exists -----

      const colName = identifierColumn.trim();
      if (!parsed.headers.includes(colName)) {
        return NextResponse.json(
          {
            error: `Column "${colName}" not found in file. Available columns: ${parsed.headers.join(", ")}`,
          },
          { status: 400 },
        );
      }

      if (parsed.rows.length === 0) {
        return NextResponse.json(
          { error: "File contains no data rows" },
          { status: 400 },
        );
      }

      // ----- 8. PROMPT 7: Canonicalize headers, exclude identifier column -----
      //
      // Headers are trimmed, empty strings removed, identifier column excluded.
      // This is the canonical schema that will be stored immutably.

      const canonicalHeaders = parsed.headers
        .map((h) => h.trim())
        .filter(Boolean)
        .filter((h) => h !== colName);

      // ----- 9. PROMPT 5: Hash identifiers + detect in-file duplicates -----
      //
      // A Set tracks every hashed identifier. If a duplicate hash is found,
      // the ENTIRE upload is aborted — no partial inserts.

      const insertRows: RecordInsertRow[] = [];
      const seenHashes = new Set<string>();
      let skipped = 0;

      for (const row of parsed.rows) {
        const identifierValue = row[colName];

        // Skip rows with empty identifier
        if (!identifierValue || identifierValue.trim() === "") {
          skipped++;
          continue;
        }

        // Hash the identifier
        const identHash = hashIdentifier(identifierValue.trim(), institute.id);

        // PROMPT 5: Duplicate detection within the file
        if (seenHashes.has(identHash)) {
          logWarn("dataset.upload.duplicate_in_file", {
            datasetId: dataset.id,
            duplicateRow: insertRows.length + skipped + 1,
          });
          return NextResponse.json(
            { error: "duplicate_identifiers_in_file" },
            { status: 400 },
          );
        }
        seenHashes.add(identHash);

        // Build payload: every column EXCEPT the identifier column
        const payload: Record<string, string> = {};
        for (const key of parsed.headers) {
          if (key !== colName) {
            payload[key] = row[key] ?? "";
          }
        }

        // Encrypt payload → pack into bytea-ready buffer
        const encrypted = encryptPayload(payload);
        const payloadBuffer = toBuffer(encrypted);

        insertRows.push({
          identifierHash: identHash,
          encryptedPayload: payloadBuffer,
        });
      }

      // Free parsed rows — we only need insertRows from here
      parsed.rows.length = 0;

      if (insertRows.length === 0) {
        return NextResponse.json(
          { error: "No valid rows to insert (all identifiers were empty)" },
          { status: 400 },
        );
      }

      // ----- 10. PROMPT 6+7+8: Batch insert + persist headers (single TX) -----
      //
      // insertRecordsBatch now:
      //   • Uses ON CONFLICT (dataset_id, identifier_hash) DO NOTHING
      //   • Compares inserted vs expected — ROLLBACK on mismatch
      //   • Persists canonicalHeaders in datasets.headers
      //   • All inside a single transaction — no partial writes

      let inserted: number;
      try {
        inserted = await insertRecordsBatch(dataset.id, insertRows, canonicalHeaders);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Database insert failed";

        // Surface the specific duplicate error from PROMPT 8
        if (message === "duplicate_identifiers_in_dataset") {
          logWarn("dataset.upload.duplicate_in_dataset", { datasetId: dataset.id });
          return NextResponse.json(
            { error: "duplicate_identifiers_in_dataset" },
            { status: 400 },
          );
        }

        logError("dataset.upload.insert_error", { datasetId: dataset.id, message });
        return NextResponse.json(
          { error: "Database insert failed — no records were saved" },
          { status: 500 },
        );
      }

      // ----- 11. Audit log (counts only — NEVER row data) -----

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
        // Audit failure must not undo the insert — log and continue
        const message = err instanceof Error ? err.message : "Audit log write failed";
        logError("dataset.upload.audit_error", { datasetId: dataset.id, message });
      }

      // ----- 12. Return counts only — NEVER return rows -----

      logInfo("dataset.upload.success", {
        datasetId: dataset.id,
        inserted,
        skipped,
        headerCount: canonicalHeaders.length,
      });

      return NextResponse.json({
        success: true,
        inserted,
        skipped,
      });
    },
  );
}
