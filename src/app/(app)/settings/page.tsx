import { Settings2 } from "lucide-react";
import Link from "next/link";
import { AiTutorSetting, ClassDetailsForm, DeleteClass, LeaveClass, StudentQuestionSetting } from "@/components/classes/class-settings";
import { DangerZone, NameForm, PasswordForm } from "@/components/settings/account";
import { ThemeSwitcher } from "@/components/theme";
import { Badge, Card, CardHeader, Collapsible, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiEnabled, usageSummary } from "@/lib/transcribe";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const teacherRole = user.role === "TEACHER";
  const select = { id: true, name: true, grade: true, teacherId: true, studentQuestionCount: true, aiTutor: true, subjects: { select: { indexSource: true } } } as const;
  const [owned, memberships] = await Promise.all([
    teacherRole ? db.classroom.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "asc" }, select }) : Promise.resolve([]),
    db.membership.findMany({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { joinedAt: "asc" }, select: { role: true, classroom: { select } } }),
  ]);
  // Every class this person is in: the ones they created, then the ones they joined (as a co-teacher or a student).
  const classes = [
    ...owned.map((c) => ({ ...c, teaching: true, owner: true })),
    ...memberships.map((m) => ({ ...m.classroom, teaching: m.role === "TEACHER", owner: false })),
  ];
  const usage = new Map(await Promise.all(classes.filter((c) => c.teaching).map(async (c) => [c.id, await usageSummary(c.id)] as const)));
  const teaching = owned.length;
  const aiOn = aiEnabled();

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader title="Settings" description={<span className="inline-flex items-center gap-2">Signed in as {user.email} <Badge>{teacherRole ? "Teacher" : "Student"}</Badge></span>} />
      <Card as="section">
        <CardHeader title="Appearance" action={<ThemeSwitcher />} />
        <div className="h-2" />
      </Card>
      <Card as="section">
        <CardHeader title="Account" />
        <div className="space-y-6 px-5 pb-5">
          <NameForm name={user.name} email={user.email} />
          <PasswordForm />
        </div>
      </Card>

      <section className="space-y-3" data-testid="class-settings">
        <h2 className="flex items-center gap-2 px-1 text-[15px] font-semibold"><Settings2 className="size-5 text-primary" /> Class settings</h2>
        {classes.length === 0 && <p className="px-1 text-sm text-muted">You&apos;re not in any classes yet. <Link href="/classes" className="text-primary hover:underline">Go to Classes</Link></p>}
        {classes.map((c) => {
          const u = usage.get(c.id);
          return (
            <Collapsible key={c.id} id={`class-${c.id}`} data-testid="class-settings-item" bodyClassName="space-y-5"
              title={<span className="flex flex-wrap items-center gap-2">{c.name}{c.grade && <Badge>Class {c.grade}</Badge>}</span>}
              meta={c.teaching ? (c.owner ? "You created this class" : "You co-teach this class") : "You're a student in this class"}>
              {c.teaching ? (
                <>
                  <ClassDetailsForm classroomId={c.id} name={c.name} grade={c.grade} hasIndexedSubjects={c.subjects.some((s) => s.indexSource)} />
                  <div className="border-t border-border pt-4"><StudentQuestionSetting classroomId={c.id} count={c.studentQuestionCount} /></div>
                  <div className="border-t border-border pt-4"><AiTutorSetting classroomId={c.id} on={c.aiTutor} /></div>
                  <p className="border-t border-border pt-4 text-sm text-muted" data-testid="ai-usage">
                    {aiOn
                      ? <>AI handwriting reading is on (OpenAI GPT-6 Luna), and makes study material and marks quiz answers. Last 30 days: {u?.pages ?? 0} page{u?.pages === 1 ? "" : "s"} read, about ${(u?.usd ?? 0).toFixed(2)}. No names or accounts are sent.</>
                      : "AI handwriting reading is off (no OpenAI API key). You can still type page text and questions yourself."}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-sm text-muted">{c.owner ? "Deleting removes the class for everyone." : "Leaving removes it from your list."}</p>
                    {c.owner ? <DeleteClass classroomId={c.id} name={c.name} /> : <LeaveClass classroomId={c.id} name={c.name} />}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">Leaving removes this class from your list.</p>
                  <LeaveClass classroomId={c.id} name={c.name} />
                </div>
              )}
            </Collapsible>
          );
        })}
      </section>

      <Card as="section">
        <CardHeader title="Session and data" />
        <div className="px-5 pb-5">
          <DangerZone email={user.email} warning={teaching > 0 ? `This also deletes your ${teaching} class${teaching === 1 ? "" : "es"} and everything in them, for every student.` : undefined} />
        </div>
      </Card>
    </div>
  );
}
