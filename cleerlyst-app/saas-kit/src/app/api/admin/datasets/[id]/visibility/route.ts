import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDatasetById,
  updateDatasetVisibilityConfig,
  insertAuditLog,
} from "@/lib/database";
import { logInfo, logWarn } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// PATCH /api/admin/datasets/{id}/visibility
// ---------------------------------------------------------------------------
//
// Updates visibility_config for a DRAFT dataset.
//
// LIFECYCLE RULE: visibility_config is immutable after publish.
//   • Only datasets with status === "draft" can be updated.
//   • Published or revoked datasets return 403 "visibility_locked".
//   • Backend enforces this — never trust frontend state.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • Explicit column selection — no SELECT *.
//   • Does not log field names — only field count.
//   • Does not return visibility_config contents.
//
// ---------------------------------------------------------------------------

const MAX_FIELDS = 50;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/admin/datasets/[id]/visibility" },
    async () => {
      // ----- 1. Admin authentication -----

      if (!session?.user?.id || session.user.role !== "admin") {
        logWarn("dataset.visibility.forbidden", { reason: "not_admin" });
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      }

      const adminInstituteId = session.user.instituteId;
      const { id: datasetId } = await params;

      // ----- 2. Fetch dataset + verify ownership -----

      const dataset = await getDatasetById(datasetId);

      if (!dataset) {
        return NextResponse.json(
          { error: "Dataset not found" },
          { status: 404 },
        );
      }

      if (dataset.institute_id !== adminInstituteId) {
        logWarn("dataset.visibility.forbidden", {
          datasetId,
          reason: "wrong_institute",
        });
        return NextResponse.json(
          { error: "Dataset does not belong to your institute" },
          { status: 403 },
        );
      }

      // ----- 3. LIFECYCLE CHECK: only draft datasets -----

      if (dataset.status !== "draft") {
        logWarn("dataset.visibility.locked", {
          datasetId,
          status: dataset.status,
        });
        return NextResponse.json(
          { error: "visibility_locked" },
          { status: 403 },
        );
      }

      // ----- 4. Parse + validate request body -----

      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      // ----- DEFENSIVE VALIDATION -----
      // visibility_config must follow a strict structure:
      //   { allowed_fields: string[] }
      // No arbitrary JSON. No extra keys.

      const bodyKeys = Object.keys(body);
      if (
        bodyKeys.length !== 1 ||
        bodyKeys[0] !== "allowed_fields"
      ) {
        return NextResponse.json(
          { error: "Body must contain only { allowed_fields: string[] }" },
          { status: 400 },
        );
      }

      const { allowed_fields } = body;

      if (!Array.isArray(allowed_fields)) {
        return NextResponse.json(
          { error: "allowed_fields must be an array" },
          { status: 400 },
        );
      }

      // Validate each field name
      const MAX_FIELD_NAME_LENGTH = 128;
      const cleaned: string[] = [];
      const seen = new Set<string>();

      for (const field of allowed_fields) {
        if (typeof field !== "string") {
          return NextResponse.json(
            { error: "Each field in allowed_fields must be a string" },
            { status: 400 },
          );
        }

        const trimmed = field.trim();

        // Skip empty strings
        if (trimmed.length === 0) continue;

        // Reject excessively long field names
        if (trimmed.length > MAX_FIELD_NAME_LENGTH) {
          return NextResponse.json(
            {
              error: `Field name exceeds maximum length of ${MAX_FIELD_NAME_LENGTH} characters`,
            },
            { status: 400 },
          );
        }

        // No duplicates
        if (seen.has(trimmed)) continue;
        seen.add(trimmed);

        // Identifier column exclusion — never expose the identifier
        if (trimmed === dataset.identifier_type) continue;

        cleaned.push(trimmed);
      }

      if (cleaned.length > MAX_FIELDS) {
        return NextResponse.json(
          { error: `Maximum ${MAX_FIELDS} fields allowed` },
          { status: 400 },
        );
      }

      // ----- 5. Update visibility_config -----

      await updateDatasetVisibilityConfig(datasetId, {
        allowed_fields: cleaned,
      });

      // ----- 6. Audit log — field count only, never field names -----

      try {
        await insertAuditLog(
          session.user.id,
          "dataset.visibility_configured",
          datasetId,
          { allowedFieldsCount: cleaned.length },
        );
      } catch {
        // Audit failure must not break the response
      }

      logInfo("dataset.visibility.configured", {
        datasetId,
        allowedFieldsCount: cleaned.length,
      });

      return NextResponse.json({ success: true }, { status: 200 });
    },
  );
}
