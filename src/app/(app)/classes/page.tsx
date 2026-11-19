import { ChevronRight, Crown, User, Users } from "lucide-react";
import Link from "next/link";
import { CreateClass, CreateRoom } from "@/components/classes/create-class";
import { JoinClass } from "@/components/classes/join-class";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatJoinCode } from "@/lib/join-code";
import { ensurePersonalSpace } from "@/lib/rooms";

export const metadata = { title: "Classes" };

export default async function ClassesPage() {
  const user = await requireUser();
  await ensurePersonalSpace(user); // the layout makes it too, but renders alongside this page
  const teacher = user.role === "TEACHER";
  const studentCount = { where: { role: "STUDENT", status: "ACTIVE" } } as const;
  const include = { teacher: { select: { name: true } }, _count: { select: { members: studentCount, subjects: true } } };
  const [owned, memberships] = await Promise.all([
    teacher ? db.classroom.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, include }) : Promise.resolve([]),
    db.membership.findMany({ where: { userId: user.id }, orderBy: { joinedAt: "desc" }, include: { classroom: { include } } }),
  ]);
  const joined = memberships.filter((m) => m.status === "ACTIVE");
  const pending = memberships.filter((m) => m.status === "PENDING");
  const label = (kind: string, role: string, head: boolean) =>
    kind === "PERSONAL" ? "Only you" : kind === "ROOM" ? (role === "TEACHER" ? "Supervisor" : head ? "Student head" : "Student room") : role === "TEACHER" ? "Co-teacher" : null;
  const all = [
    ...owned.map((c) => ({ ...c, label: null as string | null })),
    ...joined.map((m) => ({ ...m.classroom, label: label(m.classroom.kind, m.role, m.classroom.teacherId === user.id) })),
  ];
  // Your own space first, then classrooms, then student rooms.
  const order = (kind: string) => (kind === "PERSONAL" ? 0 : kind === "CLASS" ? 1 : 2);
  const classes = all.map((c, i) => ({ c, i })).sort((a, b) => order(a.c.kind) - order(b.c.kind) || a.i - b.i).map(({ c }) => c);

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title={teacher ? "Your classes" : "My classes and rooms"} description={teacher ? "Create a class, set up its subjects and share the join code with your students." : "Study on your own in My space, join your class with your teacher's code, or start a student room with classmates."} />
      <Card>
        <CardHeader title={teacher ? "Create a class" : "Join a class or student room"} />
        <div className="px-5 pb-5">{teacher ? <CreateClass /> : <JoinClass />}</div>
      </Card>
      {!teacher && (
        <Card data-testid="create-room">
          <CardHeader title="Start a student room" description="A study group you run as its student head: add subjects, share notes and invite classmates with a code. Teachers can join to supervise, with only the powers you give them." />
          <div className="px-5 pb-5"><CreateRoom /></div>
        </Card>
      )}
      {teacher && (
        <Card>
          <CardHeader title="Join an existing class or a student room" description="For a class another teacher created, or a student room you've been asked to supervise. Its teacher or student head approves your request." />
          <div className="px-5 pb-5"><JoinClass asTeacher /></div>
        </Card>
      )}
      {pending.length > 0 && (
        <Card data-testid="pending-requests">
          <CardHeader title="Waiting for approval" />
          <ul className="space-y-2 px-5 pb-5">
            {pending.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5 text-sm">
                <span><span className="font-medium">{m.classroom.name}</span> <span className="text-muted">· {m.classroom.kind === "ROOM" ? `student room, head: ${m.classroom.teacher.name}` : m.classroom.teacher.name}</span></span>
                <Badge tone="warn">Request sent</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {!classes.some((c) => c.kind !== "PERSONAL") && (
        <Card><EmptyState icon={<Users className="size-5" />} title={teacher ? "No classes yet" : "You haven't joined a class yet"} description={teacher ? "Create your first class above." : "Enter a class or room code above to join, or start your own room. You can study in My space meanwhile."} /></Card>
      )}
      {classes.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/classes/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                  {c.kind === "PERSONAL" ? <User className="size-5" /> : c.kind === "ROOM" ? <Crown className="size-5" /> : c.grade ?? <Users className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {c.kind === "PERSONAL"
                      ? `Your own space · ${c._count.subjects} subject${c._count.subjects === 1 ? "" : "s"}`
                      : <>
                          {c._count.members} {c.kind === "ROOM" ? "member" : "student"}{c._count.members === 1 ? "" : "s"} · {c._count.subjects} subject{c._count.subjects === 1 ? "" : "s"}
                          {"teacher" in c && c.teacher ? ` · ${c.kind === "ROOM" ? "head: " : ""}${(c.teacher as { name: string }).name}` : ""}
                        </>}
                  </p>
                </div>
                {c.label && <Badge tone="primary">{c.label}</Badge>}
                {teacher && c.kind === "CLASS" && <Badge className="font-mono">{formatJoinCode(c.joinCode)}</Badge>}
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
