import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { CreateClass } from "@/components/classes/create-class";
import { JoinClass } from "@/components/classes/join-class";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatJoinCode } from "@/lib/join-code";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const user = await requireUser();
  const teacher = user.role === "TEACHER";
  const studentCount = { where: { role: "STUDENT", status: "ACTIVE" } } as const;
  const include = { teacher: { select: { name: true } }, _count: { select: { members: studentCount, subjects: true } } };
  const [owned, memberships] = await Promise.all([
    teacher ? db.classroom.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, include }) : Promise.resolve([]),
    db.membership.findMany({ where: { userId: user.id }, orderBy: { joinedAt: "desc" }, include: { classroom: { include } } }),
  ]);
  const joined = memberships.filter((m) => m.status === "ACTIVE");
  const pending = memberships.filter((m) => m.status === "PENDING");
  const classes = [
    ...owned.map((c) => ({ ...c, label: null as string | null })),
    ...joined.map((m) => ({ ...m.classroom, label: m.role === "TEACHER" ? "Co-teacher" : null })),
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={teacher ? "Your classes" : "My classes"} description={teacher ? "Create a class, set up its subjects and share the join code with your students." : "Join your class with the code your teacher gives you."} />
      <Card>
        <CardHeader title={teacher ? "Create a class" : "Join a class"} />
        <div className="px-5 pb-5">{teacher ? <CreateClass /> : <JoinClass />}</div>
      </Card>
      {teacher && (
        <Card>
          <CardHeader title="Join an existing class as a teacher" description="For a class another teacher already created, e.g. at your school. They approve your request." />
          <div className="px-5 pb-5"><JoinClass asTeacher /></div>
        </Card>
      )}
      {pending.length > 0 && (
        <Card data-testid="pending-requests">
          <CardHeader title="Waiting for approval" />
          <ul className="space-y-2 px-5 pb-5">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm">
                <span><span className="font-medium">{m.classroom.name}</span> <span className="text-muted">· {m.classroom.teacher.name}</span></span>
                <Badge tone="warn">Request sent</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {classes.length === 0 ? (
        <Card><EmptyState icon={<Users className="size-5" />} title={teacher ? "No classes yet" : "You haven't joined a class yet"} description={teacher ? "Create your first class above." : "Enter your class code above to join."} /></Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">{c.grade ?? <Users className="size-5" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c._count.members} student{c._count.members === 1 ? "" : "s"} · {c._count.subjects} subject{c._count.subjects === 1 ? "" : "s"}
                    {"teacher" in c && c.teacher ? ` · ${(c.teacher as { name: string }).name}` : ""}
                  </p>
                </div>
                {c.label && <Badge tone="primary">{c.label}</Badge>}
                {teacher && <Badge className="font-mono">{formatJoinCode(c.joinCode)}</Badge>}
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
