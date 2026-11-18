import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Dashboard" };

/** All of the user's classes together. Each class also has its own Dashboard tab. */
export default async function DashboardPage() {
  return <DashboardView user={await requireUser()} />;
}
