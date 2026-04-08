import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function DashboardPage() {
  redirect("/dashboard/feed");
}
