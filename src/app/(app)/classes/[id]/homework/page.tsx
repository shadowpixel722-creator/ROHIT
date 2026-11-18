import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkInsights, MakeSheetForm } from "@/components/homework/teacher";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { homeworkList } from "@/lib/homework-queries";

export const metadata = { title: "Homework" };

export default async function HomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const teacher = access.role === "TEACHER";
  const [sheets, subjects, students] = await Promise.all([
    homeworkList(id, user.id, teacher),
    teacher ? db.subject.findMany({ where: { classroomId: id }, orderBy: { position: "asc" }, select: { id: true, name: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } } }) : Promise.resolve([]),
    teacher ? db.membership.findMany({ where: { classroomId: id, role: "STUDENT", status: "ACTIVE" }, select: { userId: true, user: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  const base = `/classes/${id}/homework`;
  return (
    <div className="space-y-5">
      {teacher && <MakeSheetForm classroomId={id} subjects={subjects} />}
      <Card>
        <CardHeader icon={<ClipboardList className="size-5" />} title={teacher ? "Homework sheets" : "Your homework"} description={teacher ? "Drafts are only visible to you until you publish them." : "Answer in the app, then hand it in. Your teacher marks it."} />
        {sheets.length === 0 ? <EmptyState title="No homework yet" description={teacher ? "Make a sheet above." : "Your teacher hasn't set any homework here yet."} /> : (
          <ul className="divide-y divide-border px-5 pb-3">
            {sheets.map((s) => (
              <li key={s.id} data-testid="homework-row">
                <Link href={`${base}/${s.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:opacity-80">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.title}</span><span className="block text-xs text-muted">{s.chapter ?? "General"} · {s.questions} questions · {s.outOf} marks</span></span>
                  {teacher ? (
                    <>
                      {!s.published && <Badge tone="warn">Draft</Badge>}
                      {s.published && <span className="text-xs text-muted">{s.handedIn} handed in · {s.marked} marked{s.average !== null ? ` · average ${s.average}%` : ""}</span>}
                    </>
                  ) : s.mine?.confirmed ? <Badge tone="success">{s.mine.total} / {s.outOf}</Badge> : s.mine?.submitted ? <Badge>Handed in</Badge> : <Badge tone="primary">To do</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {teacher && <HomeworkInsights classroomId={id} className={access.classroom.name} sheets={sheets} students={students.map((s) => ({ id: s.userId, name: s.user.name }))} />}
    </div>
  );
}
