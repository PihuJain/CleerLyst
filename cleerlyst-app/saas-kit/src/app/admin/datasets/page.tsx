import { requireAdminAccess } from "@/lib/admin-auth";
import { getAdminDatasetsForInstitute } from "@/lib/database";
import { AdminDatasetListClient } from "@/components/admin/admin-dataset-list-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/datasets
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Admin role required — redirects otherwise.
//   • Datasets filtered by admin's institute_id — no cross-institute leaks.
//   • Only metadata columns: id, title, type, status, created_at, published_at.
//   • No record counts, no matched users, no dataset_records.
//   • No visibility_config. No student-level data.
//
// ---------------------------------------------------------------------------

export default async function AdminDatasetsPage() {
  const adminUser = await requireAdminAccess();

  const datasets = await getAdminDatasetsForInstitute(adminUser.instituteId);

  // Serialize dates for the client component
  const serialized = datasets.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    status: d.status,
    has_headers: d.has_headers,
    has_visibility: d.has_visibility,
    created_at: d.created_at.toISOString(),
    published_at: d.published_at ? d.published_at.toISOString() : null,
  }));

  return <AdminDatasetListClient datasets={serialized} />;
}
