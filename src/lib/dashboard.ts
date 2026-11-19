import "server-only";
import { db } from "./db";
import { todayKey } from "./dates";
import { byWeek, groupAverage, overall, recentWeeks, summariseSubject } from "./progress";
import { chapterPercents, classAssessments, type AssessmentRow } from "./study";

export type DashAssessment = AssessmentRow & { classId: string; className: string };

/** Chapters (of the given ones) that have approved quiz questions (written or multiple choice). */
async function readyChapters(chapterIds: string[]) {
  if (chapterIds.length === 0) return new Set<string>();
  const [cards, questions] = await Promise.all([
    db.mcqQuestion.groupBy({ by: ["chapterId"], where: { chapterId: { in: chapterIds }, status: "APPROVED" } }),
    db.question.groupBy({ by: ["chapterId"], where: { chapterId: { in: chapterIds }, status: "APPROVED" } }),
  ]);
  return new Set([...cards, ...questions].map((r) => r.chapterId));
}

/** A student's own dashboard across every class they're in. Only their own quizzes are read. */
export async function studentDashboard(userId: string, today: string, onlyClassId?: string) {
  const memberships = await db.membership.findMany({
    where: { userId, status: "ACTIVE", role: "STUDENT", ...(onlyClassId ? { classroomId: onlyClassId } : {}) },
    orderBy: { joinedAt: "asc" },
    select: { classroom: { select: { id: true, name: true, kind: true, _count: { select: { subjects: true } } } } },
  });
  // A personal space nobody has set up yet doesn't count: the home page then offers ways to start learning.
  const classes = memberships.map((m) => m.classroom)
    .filter((c) => onlyClassId || c.kind !== "PERSONAL" || c._count.subjects > 0)
    .map((c) => ({ id: c.id, name: c.name }));
  const classIds = classes.map((c) => c.id);
  const className = new Map(classes.map((c) => [c.id, c.name]));

  const [upcomingByClass, subjects, recent] = await Promise.all([
    Promise.all(classes.map((c) => classAssessments(c.id, today, userId, { from: today, take: 40 }))),
    db.subject.findMany({
      where: { classroomId: { in: classIds } },
      orderBy: [{ classroomId: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, color: true, classroomId: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
    }),
    db.quizAttempt.findMany({
      where: { userId, submittedAt: { not: null }, chapter: { subject: { classroomId: { in: classIds } } } },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: { id: true, score: true, total: true, submittedAt: true, chapter: { select: { id: true, name: true, subject: { select: { name: true, classroomId: true } } } } },
    }),
  ]);

  const upcoming: DashAssessment[] = upcomingByClass
    .flatMap((rows, i) => rows.map((r) => ({ ...r, classId: classes[i].id, className: classes[i].name })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const nextOf = (kind: string) => upcoming.find((r) => r.kind === kind) ?? null;

  const chapterIds = subjects.flatMap((s) => s.chapters.map((c) => c.id));
  const [ready, percents] = await Promise.all([readyChapters(chapterIds), chapterPercents(userId, chapterIds)]);
  const progress = subjects.map((s) => ({
    id: s.id, name: s.name, color: s.color, classId: s.classroomId, className: className.get(s.classroomId) ?? "",
    ...summariseSubject(s.chapters.map((c) => ({ id: c.id, name: c.name, ready: ready.has(c.id), percent: percents.get(c.id) ?? null }))),
  })).filter((s) => s.ready > 0);

  return {
    classes,
    next: { EXAM: nextOf("EXAM"), TEST: nextOf("TEST"), ASSIGNMENT: nextOf("ASSIGNMENT") },
    upcoming: upcoming.filter((r) => r.days <= 30).slice(0, 8),
    progress,
    totals: overall(progress),
    recent: recent.map((a) => ({
      id: a.id, score: a.score ?? 0, total: a.total, submittedAt: a.submittedAt!,
      chapterId: a.chapter.id, chapterName: a.chapter.name, subjectName: a.chapter.subject.name, classId: a.chapter.subject.classroomId,
    })),
  };
}

/**
 * A teacher's dashboard across the classes they teach. Student figures are counts and averages only,
 * never names, and an average is shown only when at least 3 students are in it.
 */
export async function teacherDashboard(userId: string, today: string, onlyClassId?: string) {
  const [owned, coTaught] = await Promise.all([
    db.classroom.findMany({ where: { teacherId: userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, grade: true } }),
    db.membership.findMany({ where: { userId, role: "TEACHER", status: "ACTIVE", classroom: { kind: "CLASS" } }, select: { classroom: { select: { id: true, name: true, grade: true } } } }),
  ]);
  const classes = [...owned, ...coTaught.map((m) => m.classroom)].filter((c) => !onlyClassId || c.id === onlyClassId);
  const classIds = classes.map((c) => c.id);

  const [students, pendingNotes, cardDrafts, questionDrafts, upcomingByClass] = await Promise.all([
    db.membership.groupBy({ by: ["classroomId"], where: { classroomId: { in: classIds }, role: "STUDENT", status: "ACTIVE" }, _count: true }),
    db.note.groupBy({ by: ["classroomId"], where: { classroomId: { in: classIds }, status: "PENDING" }, _count: true }),
    db.mcqQuestion.findMany({ where: { status: "DRAFT", chapter: { subject: { classroomId: { in: classIds } } } }, select: { chapter: { select: { subject: { select: { classroomId: true } } } } } }),
    db.question.findMany({ where: { status: "DRAFT", chapter: { subject: { classroomId: { in: classIds } } } }, select: { chapter: { select: { subject: { select: { classroomId: true } } } } } }),
    Promise.all(classes.map((c) => classAssessments(c.id, today, undefined, { from: today, take: 20 }))),
  ]);
  const count = (rows: { classroomId: string; _count: number }[]) => new Map(rows.map((r) => [r.classroomId, r._count]));
  const studentCount = count(students);
  const pending = count(pendingNotes);
  const drafts = new Map<string, number>();
  for (const d of [...cardDrafts, ...questionDrafts]) drafts.set(d.chapter.subject.classroomId, (drafts.get(d.chapter.subject.classroomId) ?? 0) + 1);

  const upcoming: DashAssessment[] = upcomingByClass
    .flatMap((rows, i) => rows.map((r) => ({ ...r, classId: classes[i].id, className: classes[i].name })))
    .filter((r) => r.days <= 30)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  // For each upcoming date: how many of the class's students have practised its chapters, and their average.
  const practice = await Promise.all(upcoming.map(async (r) => {
    const chapterIds = r.chapters.map((c) => c.id);
    const attempts = await db.quizAttempt.findMany({
      where: { chapterId: { in: chapterIds }, submittedAt: { not: null }, user: { memberships: { some: { classroomId: r.classId, role: "STUDENT", status: "ACTIVE" } } } },
      select: { userId: true, score: true, total: true },
    });
    const byStudent = new Map<string, { score: number; total: number }>();
    for (const a of attempts) {
      const s = byStudent.get(a.userId) ?? { score: 0, total: 0 };
      s.score += a.score ?? 0;
      s.total += a.total;
      byStudent.set(a.userId, s);
    }
    const scores = [...byStudent.values()].filter((s) => s.total > 0).map((s) => (s.score / s.total) * 100);
    return { id: r.id, practised: byStudent.size, students: studentCount.get(r.classId) ?? 0, average: groupAverage(scores) };
  }));
  const practiceById = new Map(practice.map((p) => [p.id, p]));

  return {
    classes: classes.map((c) => ({
      ...c, students: studentCount.get(c.id) ?? 0, pending: pending.get(c.id) ?? 0, drafts: drafts.get(c.id) ?? 0,
      next: upcoming.find((r) => r.classId === c.id) ?? null,
    })),
    upcoming: upcoming.map((r) => ({ ...r, practice: practiceById.get(r.id)! })),
  };
}

/* ------------------------------------------------------------------ chart data */

export const CHART_WEEKS = 8;
const weekLabel = (key: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00.000Z`));
const pct = (score: number | null, total: number) => (total > 0 ? Math.round(((score ?? 0) / total) * 100) : 0);

/** A student's own charts: recent quiz scores, and quizzes per week. */
export async function studentCharts(userId: string, classIds: string[], today: string, tz: string) {
  const weeks = recentWeeks(today, CHART_WEEKS);
  const since = new Date(`${weeks[0]}T00:00:00.000Z`);
  since.setUTCDate(since.getUTCDate() - 1);
  const attempts = await db.quizAttempt.findMany({
    where: { userId, submittedAt: { gte: since }, chapter: { subject: { classroomId: { in: classIds } } } },
    orderBy: { submittedAt: "asc" },
    select: { score: true, total: true, submittedAt: true, chapter: { select: { name: true } } },
  });
  const dated = attempts.map((a) => ({ day: todayKey(tz, a.submittedAt!), item: a }));
  const grouped = byWeek(dated, weeks);
  return {
    trend: dated.slice(-12).map(({ day, item }) => ({ label: weekLabel(day), detail: item.chapter.name, value: pct(item.score, item.total) })),
    weekly: weeks.map((w) => ({ label: weekLabel(w), value: grouped.get(w)!.length })),
  };
}

/**
 * Class-wide charts for a teacher: quizzes per week, the weekly class average, and the average per
 * chapter (weakest first). An average is shown only when at least 3 students are in it.
 */
export async function teacherCharts(classIds: string[], multipleClasses: boolean, today: string, tz: string) {
  const weeks = recentWeeks(today, CHART_WEEKS);
  const since = new Date(`${weeks[0]}T00:00:00.000Z`);
  since.setUTCDate(since.getUTCDate() - 1);
  const attempts = await db.quizAttempt.findMany({
    where: { submittedAt: { gte: since }, user: { role: "STUDENT" }, chapter: { subject: { classroomId: { in: classIds } } } },
    select: { userId: true, score: true, total: true, submittedAt: true, chapterId: true, chapter: { select: { name: true, subject: { select: { classroom: { select: { name: true } } } } } } },
  });
  const grouped = byWeek(attempts.map((a) => ({ day: todayKey(tz, a.submittedAt!), item: a })), weeks);

  // Each student counts once per group: their own average, then the group's average of those.
  const perStudent = (list: typeof attempts) => {
    const m = new Map<string, number[]>();
    for (const a of list) (m.get(a.userId) ?? m.set(a.userId, []).get(a.userId)!).push(pct(a.score, a.total));
    return [...m.values()].map((v) => v.reduce((s, x) => s + x, 0) / v.length);
  };

  const byChapter = new Map<string, typeof attempts>();
  for (const a of attempts) (byChapter.get(a.chapterId) ?? byChapter.set(a.chapterId, []).get(a.chapterId)!).push(a);
  const chapters = [...byChapter.values()]
    .map((list) => ({ label: list[0].chapter.name, detail: multipleClasses ? list[0].chapter.subject.classroom.name : undefined, value: groupAverage(perStudent(list)), students: new Set(list.map((a) => a.userId)).size }))
    .filter((c): c is typeof c & { value: number } => c.value !== null)
    .sort((a, b) => a.value - b.value)
    .slice(0, 6);

  return {
    weekly: weeks.map((w) => ({ label: weekLabel(w), value: grouped.get(w)!.length })),
    averages: weeks.flatMap((w) => { const v = groupAverage(perStudent(grouped.get(w)!)); return v === null ? [] : [{ label: weekLabel(w), value: v }]; }),
    chapters,
  };
}
