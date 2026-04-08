import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatasetById, revokeDataset } from "@/lib/database";
import { logInfo, logWarn, logError } from "@/lib/logger";
import { runWithRequestContext } from "@/lib/request-context";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/datasets/{id}/revoke
// ---------------------------------------------------------------------------
//
// Transitions a dataset to 'revoked' status.
//
// SECURITY INVARIANTS:
//   • Admin role required — 403 for non-admins.
//   • Institute ownership enforced — 403 for wrong institute.
//   • institute_id is NEVER included in the response.
//   • title is NEVER included in the response.
//   • published_at is NEVER mutated or returned.
//   • No record counts, no user lists, no notifications.
//   • No record deletion — dataset_records are untouched.
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
    { requestId, actorUserId, route: "/api/admin/datasets/[id]/revoke" },
    async () => {
      // ----- 1. Admin authentication -----

      if (!session?.user?.id || session.user.role !== "admin") {
        logWarn("dataset.revoke.forbidden", { reason: "not_admin" });
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
        logWarn("dataset.revoke.not_found", { datasetId });
        return NextResponse.json(
          { error: "Dataset not found" },
          { status: 404 },
        );
      }

      if (dataset.institute_id !== adminInstituteId) {
        logWarn("dataset.revoke.forbidden", { datasetId, reason: "wrong_institute" });
        return NextResponse.json(
          { error: "Dataset does not belong to your institute" },
          { status: 403 },
        );
      }

      // ----- 3. LIFECYCLE CHECK: only published datasets can be revoked -----

      if (dataset.status !== "published") {
        logWarn("dataset.revoke.wrong_status", {
          datasetId,
          status: dataset.status,
        });
        return NextResponse.json(
          { error: "cannot_revoke_non_published_dataset" },
          { status: 400 },
        );
      }

      // ----- 4. Revoke (transactional: status update + audit log) -----

      let result: { id: string; status: string };
      try {
        result = await revokeDataset(datasetId, adminUserId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Revoke failed";
        logError("dataset.revoke.error", { datasetId, message });
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // ----- 5. Build response — no institute_id, no title, no published_at -----

      logInfo("dataset.revoke.success", { datasetId });

      return NextResponse.json({
        success: true,
        dataset_id: result.id,
        status: result.status,
      });
    },
  );
}
