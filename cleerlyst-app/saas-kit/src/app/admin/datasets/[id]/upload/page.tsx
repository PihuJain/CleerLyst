import { requireAdminAccess } from "@/lib/admin-auth";
import { getDatasetById } from "@/lib/database";
import { redirect } from "next/navigation";
import { AdminDatasetUploadClient } from "@/components/admin/admin-dataset-upload-client";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /admin/datasets/[id]/upload
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Admin role required — redirects otherwise.
//   • Institute ownership enforced — redirects if dataset belongs to another.
//   • Only metadata passed to client: id, title, identifier_type, status.
//   • No record data. No visibility_config. No student info.
//
// ---------------------------------------------------------------------------

export default async function AdminDatasetUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminUser = await requireAdminAccess();
  const { id: datasetId } = await params;

  const dataset = await getDatasetById(datasetId);

  // Not found or wrong institute → redirect back
  if (!dataset || dataset.institute_id !== adminUser.instituteId) {
    redirect("/admin/datasets");
  }

  // Cannot upload to revoked dataset
  if (dataset.status === "revoked") {
    redirect("/admin/datasets");
  }

  return (
    <AdminDatasetUploadClient
      datasetId={dataset.id}
      datasetTitle={dataset.title}
      datasetStatus={dataset.status}
      identifierType={dataset.identifier_type}
      audienceType={dataset.audience_type}
    />
  );
}
