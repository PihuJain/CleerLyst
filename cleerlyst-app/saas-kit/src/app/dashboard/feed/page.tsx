import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FeedClient } from "@/components/dashboard/feed-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/feed");
  }

  return (
    <Suspense>
      <FeedClient />
    </Suspense>
  );
}
