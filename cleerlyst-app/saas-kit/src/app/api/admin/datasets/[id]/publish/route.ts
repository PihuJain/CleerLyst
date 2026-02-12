import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatasetById, publishDataset } from "@/lib/database";
import { config } from "@/lib/config";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/{id}/publish
// ---------------------------------------------------------------------------
//
// Transitions a dataset from draft → published.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • institute_id is NEVER included in the response.
//   • No counts, no user lists, no notifications.
//   • No row-level or record-level data.
//
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const session = await auth();
  const actorUserId = session?.user?.id ?? null;

  return runWithRequestContext(
    { requestId, actorUserId, route: "/api/admin/datasets/[id]/publish" },
    async () => {
      // ----- 1. Admin authentication -----

      if (!session?.user?.id || session.user.role !== "admin") {
        logWarn("dataset.publish.forbidden", { reason: "not_admin" });
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      }

      const adminUserId = session.user.id;
      const adminInstituteId = session.user.instituteId;
      const { id: datasetId } = await params;

      // ----- 2. Fetch dataset + verify institute ownership -----

      const dataset = await getDatasetById(datasetId);

      if (!dataset) {
        logWarn("dataset.publish.not_found", { datasetId });
        return NextResponse.json(
          { error: "Dataset not found" },
          { status: 404 },
        );
      }

      if (dataset.institute_id !== adminInstituteId) {
        logWarn("dataset.publish.forbidden", { datasetId, reason: "wrong_institute" });
        return NextResponse.json(
          { error: "Dataset does not belong to your institute" },
          { status: 403 },
        );
      }

      // ----- 3. LIFECYCLE CHECK: must be draft -----

      if (dataset.status !== "draft") {
        logWarn("dataset.publish.wrong_status", {
          datasetId,
          status: dataset.status,
        });
        return NextResponse.json(
          { error: "Only draft datasets can be published" },
          { status: 400 },
        );
      }

      // ----- 4. PRECONDITION: visibility_config.allowed_fields must be non-empty -----

      const visConfig = dataset.visibility_config as {
        allowed_fields?: string[];
      } | null;

      const allowedFields = visConfig?.allowed_fields;

      if (
        !Array.isArray(allowedFields) ||
        allowedFields.length === 0
      ) {
        logWarn("dataset.publish.no_visible_fields", { datasetId });
        return NextResponse.json(
          { error: "no_visible_fields_selected" },
          { status: 400 },
        );
      }

      // ----- 5. Publish (transactional: status update + audit log) -----

      let result: { id: string; title: string; published_at: Date };
      try {
        result = await publishDataset(datasetId, adminUserId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Publish failed";
        logError("dataset.publish.error", { datasetId, message });
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // ----- 6. Build response -----

      logInfo("dataset.publish.success", {
        datasetId,
        allowedFieldsCount: allowedFields.length,
      });

      return NextResponse.json({
        success: true,
        dataset_id: result.id,
        title: result.title,
        published_at: result.published_at.toISOString(),
        universal_link: `${config.baseUrl}/datasets/${result.id}`,
      });
    },
  );
}
