import Papa from "papaparse";
import * as XLSX from "xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed row — column name → string value. */
export type ParsedRow = Record<string, string>;

export interface ParseResult {
  /** Column headers found in the file. */
  headers: string[];
  /** Parsed data rows (no raw file content retained). */
  rows: ParsedRow[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a CSV or XLSX file buffer into header + row arrays.
 *
 * SECURITY:
 *   • The raw ArrayBuffer is consumed and NOT retained.
 *   • No file is written to disk — everything stays in memory.
 *   • The caller must null-out the buffer after this call returns.
 *
 * @param buffer   - Raw file bytes (from request.formData())
 * @param mimeType - MIME type or file extension hint
 */
export function parseFile(buffer: ArrayBuffer, mimeType: string): ParseResult {
  const isXlsx =
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("sheet") ||
    mimeType.endsWith(".xlsx") ||
    mimeType.endsWith(".xls");

  if (isXlsx) {
    return parseXlsx(buffer);
  }
  return parseCsv(buffer);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(buffer: ArrayBuffer): ParseResult {
  const text = new TextDecoder("utf-8").decode(buffer);

  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(
      `CSV parse failed: ${result.errors[0]?.message ?? "unknown error"}`,
    );
  }

  const headers = result.meta.fields ?? [];

  return { headers, rows: result.data };
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

function parseXlsx(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("XLSX file contains no sheets");
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error("XLSX file contains no sheets");
  }

  // Convert to array-of-objects with string headers
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  if (raw.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(raw[0]!);

  // Coerce every cell to string — we never store typed values
  const rows: ParsedRow[] = raw.map((row) => {
    const out: ParsedRow = {};
    for (const key of headers) {
      const val = row[key];
      out[key] = val == null ? "" : String(val).trim();
    }
    return out;
  });

  return { headers, rows };
}
