import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionTabs } from "@/components/classes/section-tabs";
import { Badge } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function ClassLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const { classroom, role } = access;
  const teacher = role === "TEACHER";
  const [teacherUser, memberCount, pending] = await Promise.all([
    db.user.findUnique({ where: { id: classroom.teacherId }, select: { name: true, school: true } }),
    db.membership.count({ where: { classroomId: id, role: "STUDENT", status: "ACTIVE" } }),
    teacher ? db.note.count({ where: { classroomId: id, status: "PENDING" } }) : Promise.resolve(0),
  ]);
  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border pb-4">
        <div className="min-w-0">
          <Link href="/classes" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text print:hidden"><ArrowLeft className="size-3.5" /> All classes</Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{classroom.name}</h1>
            {classroom.grade && <Badge>Class {classroom.grade}</Badge>}
            <Badge tone="primary">{teacher ? "You teach this class" : "Student"}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {teacherUser?.name}{teacherUser?.school && ` · ${teacherUser.school}`} · {memberCount} student{memberCount === 1 ? "" : "s"}
          </p>
        </div>
      </header>
      <SectionTabs classroomId={id} teacher={teacher} pending={pending} />
      {children}
    </div>
  );
}
