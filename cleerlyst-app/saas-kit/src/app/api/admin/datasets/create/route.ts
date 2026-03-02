import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createDataset } from "@/lib/database";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/create
// ---------------------------------------------------------------------------
//
// Creates a new dataset in 'draft' status.
//
// Body (JSON):
//   title           — string, required
//   type            — 'placement' | 'academic' | 'fest' | 'finance' | 'other'
//   description     — string, optional
//   identifier_type — 'email' | 'reg_no'
//   expires_at      — ISO 8601 string, optional
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Dataset is always created in 'draft' status — caller cannot override.
//   • institute_id is derived from session — caller cannot spoof.
//   • Audit log written — action only, never payload.
//   • Returns only { datasetId, title, status } — no internal fields.
//
// ---------------------------------------------------------------------------

const VALID_TYPES = ["placement", "academic", "fest", "finance", "other"];
const VALID_IDENTIFIER_TYPES = ["email", "reg_no"];
const VALID_AUDIENCE_TYPES = ["restricted", "public"] as const;

export async function POST(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/admin/datasets/create" },
    async () => {
      // ----- 1. Admin authentication -----

      if (!session?.user?.id || session.user.role !== "admin") {
        logWarn("dataset.create.forbidden", { reason: "not_admin" });
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      }

      const adminUserId = session.user.id;
      const adminInstituteId = session.user.instituteId;

      // ----- 2. Parse & validate body -----

      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      const title = typeof body.title === "string" ? body.title.trim() : "";
      const type = typeof body.type === "string" ? body.type.trim() : "";
      const description =
        typeof body.description === "string" ? body.description.trim() : null;
      const identifierType =
        typeof body.identifier_type === "string"
          ? body.identifier_type.trim()
          : "";
      const audienceType =
        typeof body.audience_type === "string"
          ? body.audience_type.trim()
          : "restricted";
      const expiresAtRaw =
        typeof body.expires_at === "string" ? body.expires_at.trim() : null;

      if (!title) {
        return NextResponse.json(
          { error: "title is required" },
          { status: 400 },
        );
      }

      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          {
            error: `type must be one of: ${VALID_TYPES.join(", ")}`,
          },
          { status: 400 },
        );
      }

      if (!VALID_IDENTIFIER_TYPES.includes(identifierType)) {
        return NextResponse.json(
          {
            error: `identifier_type must be one of: ${VALID_IDENTIFIER_TYPES.join(", ")}`,
          },
          { status: 400 },
        );
      }

      if (
        !(VALID_AUDIENCE_TYPES as readonly string[]).includes(audienceType)
      ) {
        return NextResponse.json(
          {
            error: `audience_type must be one of: ${VALID_AUDIENCE_TYPES.join(", ")}`,
          },
          { status: 400 },
        );
      }

      let expiresAt: Date | null = null;
      if (expiresAtRaw) {
        const parsed = new Date(expiresAtRaw);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "expires_at must be a valid ISO 8601 date" },
            { status: 400 },
          );
        }
        expiresAt = parsed;
      }

      // ----- 3. Create dataset (transactional: row + audit log) -----

      let result: { id: string; title: string; status: string; created_at: Date };
      try {
        result = await createDataset(
          {
            instituteId: adminInstituteId,
            createdBy: adminUserId,
            title,
            type,
            description,
            identifierType,
            audienceType: audienceType as "restricted" | "public",
            expiresAt,
          },
          adminUserId,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Dataset creation failed";
        logError("dataset.create.error", { message });
        return NextResponse.json({ error: message }, { status: 500 });
      }

      // ----- 4. Return safe fields only -----

      logInfo("dataset.create.success", {
        datasetId: result.id,
        title: result.title,
      });

      return NextResponse.json({
        success: true,
        datasetId: result.id,
        title: result.title,
        status: result.status,
      });
    },
  );
}
