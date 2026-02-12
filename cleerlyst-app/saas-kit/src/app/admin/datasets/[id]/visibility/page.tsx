import { requireAdminAccess } from "@/lib/admin-auth";
import { getDatasetById } from "@/lib/database";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { DatasetVisibilityClient } from "@/components/admin/dataset-visibility-client";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /admin/datasets/[id]/visibility
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Admin role required — redirects otherwise.
//   • Institute ownership enforced — redirects if wrong institute.
//   • Only safe metadata passed to client: id, title, type, status,
//     headers, visibility_config, identifier_type.
//   • No record data. No student info. No created_by.
//   • Revoked datasets → 404 (no reason to configure them).
//
// ---------------------------------------------------------------------------

export default async function AdminDatasetVisibilityPage({
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

  // Revoked datasets have no business on this page
  if (dataset.status === "revoked") {
    notFound();
  }

  // Extract only the fields the client needs — nothing internal
  const visConfig = dataset.visibility_config as {
    allowed_fields?: string[];
  } | null;

  return (
    <DatasetVisibilityClient
      datasetId={dataset.id}
      datasetTitle={dataset.title}
      datasetType={dataset.type}
      datasetStatus={dataset.status}
      headers={Array.isArray(dataset.headers) ? (dataset.headers as string[]) : []}
      allowedFields={Array.isArray(visConfig?.allowed_fields) ? visConfig.allowed_fields : []}
      identifierType={dataset.identifier_type}
    />
  );
}
