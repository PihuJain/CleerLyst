import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { config } from "@/lib/config";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// /datasets/[id]
// ---------------------------------------------------------------------------
//
// SECURITY INVARIANTS:
//   • Auth required — unauthenticated users are redirected to /auth/signin.
//   • No separate metadata fetch — only /api/datasets/{id}/me is called.
//   • No dataset-specific title — generic "Verification Result" always.
//   • Identical structural HTML tree for matched AND unmatched states.
//   • No 404 — unmatched returns a generic message, same layout.
//   • No record counts, no status, no institute info.
//
// ---------------------------------------------------------------------------

interface MeResponse {
  matched: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export default async function DatasetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: datasetId } = await params;

  // ----- 1. Build server-side fetch with auth cookies -----

  const baseUrl = config.baseUrl;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/datasets/${datasetId}/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    // Network failure — render as unmatched, same layout
    res = new Response(JSON.stringify({ matched: false }), { status: 200 });
  }

  // ----- 2. Handle 401 → redirect to sign-in -----

  if (res.status === 401) {
    redirect("/auth/signin");
  }

  // ----- 3. Parse response -----

  let body: MeResponse;
  try {
    body = (await res.json()) as MeResponse;
  } catch {
    body = { matched: false };
  }

  const isMatched = body.matched === true && body.data != null;
  const fields = isMatched ? body.data! : null;

  // ----- 4. Render — identical structure for both branches -----

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Verification Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields ? (
                <dl className="divide-y divide-gray-200">
                  {Object.entries(fields).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between py-3 text-sm"
                    >
                      <dt className="font-medium text-gray-600">{key}</dt>
                      <dd className="text-gray-900">
                        {value != null ? String(value) : "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-center text-gray-500 py-6">
                  No record available for this dataset.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-400">
          If you believe this is an error, contact your institution.
        </p>
      </div>
    </div>
  );
}
