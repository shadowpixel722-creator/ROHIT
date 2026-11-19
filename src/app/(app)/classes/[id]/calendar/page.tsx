import { CalendarDays, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentActions, AssessmentForm } from "@/components/calendar/assessment-form";
import { StudyPlan } from "@/components/calendar/study-plan";
import { ReadinessBadge } from "@/components/study/readiness-badge";
import { Badge, Card, CardHeader, cn, Collapsible, EmptyState } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { countdown, isMonthKey, kindColor, kindLabel, monthGrid, shiftMonth } from "@/lib/assessments";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { dateToKey } from "@/lib/dates";
import { planFor, planView } from "@/lib/plan";
import { getToday } from "@/lib/server";
import { classAssessments } from "@/lib/study";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Teachers add tests, assignments and exams here; students can only look. */
export default async function CalendarPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const { id } = await params;
  const { m } = await searchParams;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  // teacher: makes and checks study material. learner: practises with it. (In their own space a student is both.)
  const teacher = can(access, "study");
  const learner = access.role === "STUDENT";
  const today = await getToday();
  const month = isMonthKey(m) ? m : today.slice(0, 7);

  const [rows, subjects, patterns] = await Promise.all([
    classAssessments(id, today, learner ? user.id : undefined),
    teacher ? db.subject.findMany({ where: { classroomId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } } }) : Promise.resolve([]),
    teacher ? db.examPattern.findMany({ where: { classroomId: id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, lessons: { select: { chapterId: true } } } }) : Promise.resolve([]),
  ]);
  const formPatterns = patterns.map((p) => ({ id: p.id, name: p.name, lessonIds: p.lessons.map((l) => l.chapterId) }));
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) (byDay.get(r.date) ?? byDay.set(r.date, []).get(r.date)!).push(r);
  const upcoming = rows.filter((r) => r.days >= 0);
  const past = rows.filter((r) => r.days < 0).reverse().slice(0, 10);
  // Students: a study plan for each test or exam in the next 60 days that covers chapters.
  const planned = !learner ? [] : upcoming.filter((r) => r.days >= 0 && r.days <= 60 && r.kind !== "ASSIGNMENT" && r.chapters.length > 0);
  const [made, ticks] = planned.length ? await Promise.all([
    db.assessment.findMany({ where: { id: { in: planned.map((r) => r.id) } }, select: { id: true, createdAt: true } }),
    db.planDone.findMany({ where: { userId: user.id, OR: planned.map((r) => ({ key: { startsWith: `${r.id}:` } })) }, select: { key: true } }),
  ]) : [[], []];
  const madeOn = new Map(made.map((a) => [a.id, dateToKey(a.createdAt)]));
  const plans = planned.map((r) => ({ r, tasks: planFor({ id: r.id, date: r.date, start: madeOn.get(r.id) ?? today, chapters: r.chapters }) }));
  const doneKeys = new Set(ticks.map((t) => t.key));
  const plan = plans.length ? {
    view: planView(plans.flatMap((p) => p.tasks), doneKeys, today),
    done: [...doneKeys].filter((k) => plans.some((p) => p.tasks.some((t) => t.key === k))),
    exams: plans.map(({ r, tasks }) => ({ id: r.id, title: r.title, subject: r.subjectName, days: r.days, tasks: tasks.length, done: tasks.filter((t) => doneKeys.has(t.key)).length })),
  } : null;
  const base = `/classes/${id}/calendar`;
  const monthTitle = formatDate(`${month}-01`, { month: "long", year: "numeric" });

  const item = (r: (typeof rows)[number]) => (
    <li key={r.id} id={`a-${r.id}`} className="scroll-mt-24 py-3" data-testid="assessment-row">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: kindColor(r.kind) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {r.title} <Badge>{kindLabel(r.kind)}</Badge>
            {learner && r.days >= 0 && <ReadinessBadge percent={r.percent} level={r.level} />}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(r.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · <span className={cn(r.days >= 0 && r.days <= 3 && "font-medium text-warn")}>{countdown(r.days)}</span> · {r.subjectName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {r.chapters.map((c, i) => (
              <span key={c.id}>{i > 0 && ", "}<Link href={`/classes/${id}/study/${c.id}`} className="hover:text-text hover:underline">{c.name}</Link>{learner && c.percent !== null && <span className="text-faint"> ({c.percent}%)</span>}</span>
            ))}
          </p>
          {r.pattern && (
            <Link href={`/classes/${id}/exam-patterns/${r.pattern.id}`} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary hover:underline" data-testid="assessment-pattern">
              <ScrollText className="size-4" /> Exam pattern: {r.pattern.name} <ChevronRight className="size-3.5" />
            </Link>
          )}
        </div>
        {teacher && (
          <AssessmentActions classroomId={id} subjects={subjects} patterns={formPatterns} today={today} assessmentId={r.id}
            initial={{ kind: r.kind, title: r.title, date: r.date, subjectId: r.subjectId, chapterIds: r.chapters.map((c) => c.id), patternId: r.pattern?.id ?? null }} />
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      {plan && <StudyPlan classroomId={id} {...plan} />}
      {teacher && (
        <Collapsible icon={<CalendarDays className="size-5" />} title="Add a test, assignment or exam" meta="Pick a date and the chapters it covers" defaultOpen={upcoming.length === 0}>
          <AssessmentForm classroomId={id} subjects={subjects} patterns={formPatterns} today={today} />
        </Collapsible>
      )}

      <Card>
        <div className="flex items-center justify-between gap-2 px-4 pt-4 sm:px-5">
          <h2 className="text-[15px] font-semibold tracking-tight" data-testid="month-title">{monthTitle}</h2>
          <div className="flex items-center gap-1">
            <Link href={`${base}?m=${shiftMonth(month, -1)}`} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"><ChevronLeft className="size-4" /></Link>
            <Link href={base} className="rounded-lg px-2.5 py-1 text-sm text-muted hover:bg-surface-2 hover:text-text">Today</Link>
            <Link href={`${base}?m=${shiftMonth(month, 1)}`} aria-label="Next month" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"><ChevronRight className="size-4" /></Link>
          </div>
        </div>
        <div className="px-2 pb-4 pt-3 sm:px-4">
          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-faint">{WEEKDAYS.map((d) => <div key={d} className="pb-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {monthGrid(month).flat().map((cell) => {
              const events = byDay.get(cell.key) ?? [];
              return (
                <div key={cell.key} className={cn("min-h-14 min-w-0 bg-surface p-1 sm:min-h-24 sm:p-1.5", !cell.inMonth && "bg-surface-2/60 text-faint")} data-testid="day-cell">
                  <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs", cell.key === today && "bg-primary font-semibold text-primary-fg")}>{Number(cell.key.slice(8))}</span>
                  <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                    {events.map((e) => <a key={e.id} href={`#a-${e.id}`} aria-label={`${kindLabel(e.kind)}: ${e.title}`} className="size-2 rounded-full" style={{ background: kindColor(e.kind) }} />)}
                  </div>
                  <div className="mt-0.5 hidden space-y-0.5 sm:block">
                    {events.slice(0, 3).map((e) => (
                      <a key={e.id} href={`#a-${e.id}`} title={`${kindLabel(e.kind)}: ${e.title}`} className="block truncate rounded px-1 py-0.5 text-[11px] font-medium text-white" style={{ background: kindColor(e.kind) }}>{e.title}</a>
                    ))}
                    {events.length > 3 && <span className="block px-1 text-[11px] text-muted">+{events.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {(["TEST", "ASSIGNMENT", "EXAM"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: kindColor(k) }} />{kindLabel(k)}</span>)}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Coming up" />
        <div className="px-5 pb-4">
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" description={teacher ? "Add a test, assignment or exam above." : (access.kind === "ROOM" ? "Nobody has added any dates yet." : "Your teacher hasn't added any dates yet.")} />
          ) : <ul className="divide-y divide-border" data-testid="upcoming-list">{upcoming.map(item)}</ul>}
        </div>
      </Card>

      {past.length > 0 && (
        <Collapsible title="Earlier" meta={`${past.length} past date${past.length === 1 ? "" : "s"}`}>
          <ul className="divide-y divide-border">{past.map(item)}</ul>
        </Collapsible>
      )}
    </div>
  );
}
