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
//   2. Parse file entirely in memory (never touches disk)
//   3. For each row: hash identifier, encrypt payload, prepare insert
//   4. Batch-insert into dataset_records inside a transaction
//   5. Wipe the raw buffer
//   6. Log action in audit_logs (counts only, never row data)
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

      if (dataset.status === "revoked") {
        logWarn("dataset.upload.rejected", { datasetId: datasetId.trim(), reason: "revoked" });
        return NextResponse.json(
          { error: "Cannot upload to a revoked dataset" },
          { status: 400 },
        );
      }

      // Fetch institute for the salt (institute.id is the salt)
      const institute = await getInstituteById(dataset.institute_id);
      if (!institute) {
        return NextResponse.json(
          { error: "Institute not found" },
          { status: 500 },
        );
      }

      // ----- 4. Read file into memory, parse, then destroy buffer -----

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

      // ----- 5. Validate identifier column exists -----

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

      // ----- 6. Hash identifiers + encrypt payloads -----

      const insertRows: RecordInsertRow[] = [];
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

      // ----- 7. Batch insert (transactional) -----

      let inserted: number;
      try {
        inserted = await insertRecordsBatch(dataset.id, insertRows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Database insert failed";
        logError("dataset.upload.insert_error", { datasetId: dataset.id, message });
        return NextResponse.json(
          { error: "Database insert failed — no records were saved" },
          { status: 500 },
        );
      }

      // ----- 8. Audit log (counts only — NEVER row data) -----

      try {
        await insertAuditLog(adminUserId, "dataset.records_uploaded", dataset.id, {
          inserted,
          skipped,
          identifierColumn: colName,
          fileName: file.name,
          fileSizeBytes: file.size,
        });
      } catch (err) {
        // Audit failure must not undo the insert — log and continue
        const message = err instanceof Error ? err.message : "Audit log write failed";
        logError("dataset.upload.audit_error", { datasetId: dataset.id, message });
      }

      // ----- 9. Return counts only — NEVER return rows -----

      logInfo("dataset.upload.success", { datasetId: dataset.id, inserted, skipped });

      return NextResponse.json({
        success: true,
        inserted,
        skipped,
      });
    },
  );
}
