import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Class dashboard" };

/** The dashboard for this class only: dates, progress, charts and (for teachers) what needs checking. */
export default async function ClassDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!(await getClassAccess(user.id, id))) notFound();
  return <DashboardView user={user} classId={id} />;
}
