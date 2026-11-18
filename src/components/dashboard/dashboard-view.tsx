import { BarChart3, BookOpenCheck, CalendarClock, ClipboardCheck, GraduationCap, History, LineChart as LineChartIcon, NotebookPen, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { ReadinessBadge } from "@/components/study/readiness-badge";
import { Badge, ButtonLink, Card, CardHeader, cn, EmptyState, PageHeader, ProgressBar, SubjectDot } from "@/components/ui";
import { countdown, kindColor, kindLabel } from "@/lib/assessments";
import { subjectColor } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { studentCharts, studentDashboard, teacherCharts, teacherDashboard, type DashAssessment } from "@/lib/dashboard";
import { BarList, ColumnChart, LineChart } from "@/components/charts";
import { getTimeZone, getToday } from "@/lib/server";
import { classTrapMap, studentTraps } from "@/lib/mistake-queries";
import { classTrapSentence, trapSentence } from "@/lib/mistakes";

const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** "Asha Verma" -> "Asha"; "Mr Sharma" -> "Mr Sharma" (a title alone isn't a greeting). */
const firstName = (name: string) => {
  const words = name.trim().split(/\s+/);
  return /^(mr|mrs|ms|miss|dr|prof|sir|madam)\.?$/i.test(words[0] ?? "") && words[1] ? `${words[0]} ${words[1]}` : (words[0] ?? name);
};
const when = (r: DashAssessment) => `${formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })} · ${countdown(r.days)}`;

/**
 * The dashboard, either across all of a user's classes (sidebar) or for one class (the class's Dashboard tab).
 * In a class the class header is already on the page, so there's no greeting.
 */
export async function DashboardView({ user, classId }: { user: { id: string; name: string; role: string }; classId?: string }) {
  const today = await getToday();
  const tz = await getTimeZone();
  const greeting = `Hi, ${firstName(user.name)}`;
  const dateLine = formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const props = { userId: user.id, today, tz, greeting, dateLine, classId };
  return user.role === "TEACHER" ? <TeacherDashboard {...props} /> : <StudentDashboard {...props} />;
}

type ViewProps = { userId: string; today: string; tz: string; greeting: string; dateLine: string; classId?: string };
const Header = ({ greeting, dateLine, classId }: { greeting: string; dateLine: string; classId?: string }) => (classId ? null : <PageHeader title={greeting} description={dateLine} />);

/* ------------------------------------------------------------------ students */

async function StudentDashboard({ userId, today, tz, greeting, dateLine, classId }: ViewProps) {
  const d = await studentDashboard(userId, today, classId);
  if (d.classes.length === 0) {
    return (
      <div className="animate-fade-in">
        <Header greeting={greeting} dateLine={dateLine} classId={classId} />
        <Card><EmptyState icon={<Users className="size-5" />} title="Join your class to get started" description="Your dashboard shows your tests, assignments, exams and progress once you've joined a class." action={<ButtonLink href="/classes">Join a class</ButtonLink>} /></Card>
      </div>
    );
  }
  const pct = d.totals.ready ? d.totals.practised / d.totals.ready : 0;
  const charts = await studentCharts(userId, d.classes.map((c) => c.id), today, tz);
  const traps = (await studentTraps(userId, d.classes.map((c) => c.id))).filter((t) => t.status === "ACTIVE").slice(0, 3);
  const quizzesThisPeriod = charts.weekly.reduce((n, w) => n + w.value, 0);
  return (
    <div className="animate-fade-in space-y-4" data-testid="student-dashboard">
      <Header greeting={greeting} dateLine={dateLine} classId={classId} />

      <div className="grid gap-3 md:grid-cols-3">
        {(["EXAM", "TEST", "ASSIGNMENT"] as const).map((kind) => <NextCard key={kind} kind={kind} row={d.next[kind]} />)}
      </div>

      <Card data-testid="progress-card">
        <CardHeader icon={<TrendingUp className="size-5" />} title="Your learning progress" description="From your own practice quizzes. Only you can see this." />
        <div className="px-5 pb-5">
          {d.progress.length === 0 ? (
            <p className="text-sm text-muted">Your teacher hasn&apos;t published quizzes yet. When they do, your progress shows here.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="Chapters practised" value={`${d.totals.practised} of ${d.totals.ready}`} />
                <Stat label="Average score" value={d.totals.average === null ? "—" : `${d.totals.average}%`} />
                <Stat label="Quizzes taken" value={String(quizzesThisPeriod)} hint="last 8 weeks" />
              </div>
              <ProgressBar value={pct} className="mt-4" label="Chapters practised" />
              {d.progress.some((x) => x.average !== null) && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold">Average score by subject</p>
                  <BarList caption="Your average quiz score by subject" valueLabel="Average score"
                    rows={d.progress.filter((x) => x.average !== null).map((x) => ({ label: x.name, detail: `${x.practised} of ${x.ready} chapters`, value: x.average! }))} />
                </div>
              )}
              {d.progress.some((x) => x.weakest) && (
                <ul className="mt-4 space-y-1 text-sm">
                  {d.progress.filter((x) => x.weakest).map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-x-1.5 text-muted" data-testid="subject-progress">
                      <SubjectDot color={subjectColor(x.color)} /> <span className="font-medium text-text">{x.name}</span>
                      {d.classes.length > 1 && <span className="text-xs">({x.className})</span>}
                      <span>· {x.weakest!.percent === null ? "next to try:" : "practise more:"}</span>
                      <Link href={`/classes/${x.classId}/study/${x.weakest!.id}`} className="font-medium text-primary hover:underline">{x.weakest!.name}</Link>
                      {x.weakest!.percent !== null && <span>({x.weakest!.percent}%)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Card>

      {traps.length > 0 && (
        <Card data-testid="dash-traps">
          <CardHeader icon={<Target className="size-5" />} title="Your top traps" description="From your multiple-choice practice. Only you can see this." />
          <ul className="divide-y divide-border px-5 pb-3">
            {traps.map((t) => (
              <li key={t.misconceptionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1">{trapSentence(t.label, t)}</span>
                <Link href={`/classes/${t.classroomId}/mistakes`} className="font-medium text-primary hover:underline">Practise it</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="score-chart">
          <CardHeader icon={<LineChartIcon className="size-5" />} title="Your quiz scores" description="Your last 12 quizzes" />
          <div className="px-5 pb-5">
            {charts.trend.length === 0 ? <p className="text-sm text-muted">Take a quiz in Study to see your scores here.</p>
              : <LineChart points={charts.trend} caption="Your recent quiz scores, oldest first" />}
          </div>
        </Card>
        <Card data-testid="activity-chart">
          <CardHeader icon={<BarChart3 className="size-5" />} title="Quizzes per week" description="Last 8 weeks" />
          <div className="px-5 pb-5"><ColumnChart bars={charts.weekly} caption="Quizzes you took each week" valueLabel="Quizzes" /></div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<CalendarClock className="size-5" />} title="Next 30 days" />
          <div className="px-5 pb-4">
            {d.upcoming.length === 0 ? <p className="pb-2 text-sm text-muted">Nothing scheduled.</p> : (
              <ul className="divide-y divide-border" data-testid="dash-upcoming">
                {d.upcoming.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: kindColor(r.kind) }} aria-hidden />
                    <Link href={`/classes/${r.classId}/calendar#a-${r.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className={cn("text-xs", r.days <= 3 ? "font-medium text-warn" : "text-muted")}>{kindLabel(r.kind)} · {r.subjectName} · {when(r)}</span>
                    </Link>
                    <ReadinessBadge percent={r.percent} level={r.level} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader icon={<History className="size-5" />} title="Recent quizzes" />
          <div className="px-5 pb-4">
            {d.recent.length === 0 ? <p className="pb-2 text-sm text-muted">No quizzes yet. Open a chapter in Study to try one.</p> : (
              <ul className="divide-y divide-border" data-testid="dash-recent">
                {d.recent.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Link href={`/classes/${a.classId}/study/${a.chapterId}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-medium">{a.chapterName}</span>
                      <span className="text-xs text-muted">{a.subjectName} · {formatDate(a.submittedAt)}</span>
                    </Link>
                    <span className="tabular-nums font-medium">{fmtPoints(a.score)} / {a.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const NEXT_ICON = { EXAM: GraduationCap, TEST: ClipboardCheck, ASSIGNMENT: NotebookPen } as const;

function NextCard({ kind, row }: { kind: "EXAM" | "TEST" | "ASSIGNMENT"; row: DashAssessment | null }) {
  const Icon = NEXT_ICON[kind];
  const practise = row?.chapters.find((c) => c.percent === null) ?? (row ? [...row.chapters].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0] : undefined);
  return (
    <Card className="p-4" data-testid={`next-${kind.toLowerCase()}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: kindColor(kind) }}><Icon className="size-4" /> Next {kindLabel(kind).toLowerCase()}</p>
      {row ? (
        <>
          <Link href={`/classes/${row.classId}/calendar#a-${row.id}`} className="mt-2 block font-semibold leading-snug hover:underline">{row.title}</Link>
          <p className="text-xs text-muted">{row.subjectName} · {row.className}</p>
          <p className={cn("mt-1 text-sm", row.days <= 3 ? "font-medium text-warn" : "text-muted")}>{when(row)}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <ReadinessBadge percent={row.percent} level={row.level} />
            {practise && row.level !== "READY" && <Link href={`/classes/${row.classId}/study/${practise.id}`} className="text-xs font-medium text-primary hover:underline">Practise {practise.name.length > 24 ? "now" : practise.name}</Link>}
          </div>
        </>
      ) : <p className="mt-2 text-sm text-muted">None scheduled</p>}
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-xs text-muted">{label}{hint && <span className="text-faint"> · {hint}</span>}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ teachers */

async function TeacherDashboard({ userId, today, tz, greeting, dateLine, classId }: ViewProps) {
  const d = await teacherDashboard(userId, today, classId);
  if (d.classes.length === 0) {
    return (
      <div className="animate-fade-in">
        <Header greeting={greeting} dateLine={dateLine} classId={classId} />
        <Card><EmptyState icon={<Users className="size-5" />} title="Create your first class" description="Your dashboard shows each class's dates, notes to review and how students are practising." action={<ButtonLink href="/classes">Create a class</ButtonLink>} /></Card>
      </div>
    );
  }
  const charts = await teacherCharts(d.classes.map((c) => c.id), d.classes.length > 1, today, tz);
  const classTraps = (await classTrapMap(d.classes.map((c) => c.id))).slice(0, 3);
  const className = new Map(d.classes.map((c) => [c.id, c.name]));
  return (
    <div className="animate-fade-in space-y-4" data-testid="teacher-dashboard">
      <Header greeting={greeting} dateLine={dateLine} classId={classId} />

      <div className="grid gap-3 md:grid-cols-2">
        {d.classes.map((c) => (
          <Card key={c.id} className="p-4" data-testid="dash-class">
            <div className="flex items-center gap-2">
              <Link href={`/classes/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
              {c.grade && <Badge>Class {c.grade}</Badge>}
              <span className="ml-auto text-xs text-muted">{c.students} student{c.students === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Link href={`/classes/${c.id}/review`} className={cn("rounded-lg px-2.5 py-1.5", c.pending ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>
                <BookOpenCheck className="mr-1 inline size-4" />{c.pending} note{c.pending === 1 ? "" : "s"} to review
              </Link>
              <Link href={`/classes/${c.id}/study`} className={cn("rounded-lg px-2.5 py-1.5", c.drafts ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>
                <Sparkles className="mr-1 inline size-4" />{c.drafts} study item{c.drafts === 1 ? "" : "s"} to check
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">
              {c.next ? <>Next: <Link href={`/classes/${c.id}/calendar#a-${c.next.id}`} className="font-medium text-text hover:underline">{c.next.title}</Link> ({kindLabel(c.next.kind)}) · {countdown(c.next.days)}</>
                : <>Nothing scheduled. <Link href={`/classes/${c.id}/calendar`} className="text-primary hover:underline">Add a date</Link></>}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="teacher-activity">
          <CardHeader icon={<BarChart3 className="size-5" />} title="Quizzes taken per week" description={classId ? "This class, last 8 weeks" : "All your classes, last 8 weeks"} />
          <div className="px-5 pb-5"><ColumnChart bars={charts.weekly} caption="Quizzes students took each week" valueLabel="Quizzes" /></div>
        </Card>
        <Card data-testid="teacher-average">
          <CardHeader icon={<LineChartIcon className="size-5" />} title="Class average by week" description="Shown for weeks with at least 3 students" />
          <div className="px-5 pb-5">
            {charts.averages.length === 0 ? <p className="text-sm text-muted">Appears once at least 3 students take quizzes in a week.</p>
              : <LineChart points={charts.averages} caption="Class average quiz score each week" valueLabel="Class average" />}
          </div>
        </Card>
      </div>

      <Card data-testid="dash-class-traps">
        <CardHeader icon={<Target className="size-5" />} title="Top class mistakes" description="Traps students actually fell for in multiple-choice practice. Counts only, never names." />
        <div className="px-5 pb-4">
          {classTraps.length === 0 ? <p className="pb-1 text-sm text-muted">No mistakes yet. They appear once students practise multiple-choice questions.</p> : (
            <ul className="divide-y divide-border">
              {classTraps.map((r) => (
                <li key={r.misconceptionId} className="flex flex-wrap items-center gap-x-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">“{r.label}”{classId ? "" : ` (${className.get(r.classroomId)})`}: {classTrapSentence(r)}</span>
                  <Link href={`/classes/${r.classroomId}/mistakes`} className="font-medium text-primary hover:underline">Mistake Map</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card data-testid="teacher-chapters">
        <CardHeader icon={<TrendingUp className="size-5" />} title="Chapters to revisit" description="Lowest class averages first (chapters with at least 3 students)" />
        <div className="px-5 pb-5">
          {charts.chapters.length === 0 ? <p className="text-sm text-muted">Appears once at least 3 students have taken quizzes on a chapter.</p>
            : <BarList caption="Class average score by chapter, lowest first" valueLabel="Class average" rows={charts.chapters.map((c) => ({ label: c.label, detail: [c.detail, `${c.students} students`].filter(Boolean).join(" · "), value: c.value }))} />}
        </div>
      </Card>

      <Card>
        <CardHeader icon={<CalendarClock className="size-5" />} title={classId ? "Coming up: how the class is preparing" : "Coming up: how your classes are preparing"} description="Counts and averages only, never names" />
        <div className="px-5 pb-4">
          {d.upcoming.length === 0 ? <p className="pb-2 text-sm text-muted">Nothing in the next 30 days.</p> : (
            <ul className="divide-y divide-border" data-testid="dash-prep">
              {d.upcoming.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: kindColor(r.kind) }} aria-hidden />
                    <Link href={`/classes/${r.classId}/calendar#a-${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <span className="text-xs text-muted">{kindLabel(r.kind)}{classId ? "" : ` · ${r.className}`} · {r.subjectName} · {when(r)}</span>
                    <span className="ml-auto text-xs text-muted" data-testid="prep-count">
                      {r.practice.practised} of {r.practice.students} student{r.practice.students === 1 ? "" : "s"} practised
                      {r.practice.average !== null && <> · class average {r.practice.average}%</>}
                    </span>
                  </div>
                  <ProgressBar value={r.practice.students ? r.practice.practised / r.practice.students : 0} color={kindColor(r.kind)} className="mt-2" label={`${r.title}: students practised`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
