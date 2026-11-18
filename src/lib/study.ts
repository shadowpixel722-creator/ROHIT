import "server-only";
import { daysBetween, dateToKey } from "./dates";
import { db } from "./db";
import { assessmentReadiness, mastery } from "./quiz";

/** Each chapter's mastery (0–100, or null if the student hasn't taken a quiz on it), from this student's own attempts only. */
export async function chapterPercents(userId: string, chapterIds: string[]) {
  const out = new Map<string, number | null>(chapterIds.map((id) => [id, null]));
  if (chapterIds.length === 0) return out;
  const attempts = await db.quizAttempt.findMany({
    where: { userId, chapterId: { in: chapterIds }, submittedAt: { not: null }, score: { not: null } },
    orderBy: { submittedAt: "desc" },
    select: { chapterId: true, score: true, total: true },
  });
  const byChapter = new Map<string, { score: number; total: number }[]>();
  for (const a of attempts) (byChapter.get(a.chapterId) ?? byChapter.set(a.chapterId, []).get(a.chapterId)!).push({ score: a.score ?? 0, total: a.total });
  for (const [id, list] of byChapter) out.set(id, mastery(list));
  return out;
}

export type AssessmentRow = {
  id: string; kind: string; title: string; date: string; days: number;
  subjectId: string; subjectName: string; subjectColor: string;
  chapters: { id: string; name: string; percent: number | null }[];
  /** The exam pattern it follows, if the teacher chose one */
  pattern?: { id: string; name: string } | null;
  percent: number | null; level: ReturnType<typeof assessmentReadiness>["level"];
};

/** A class's assessments, soonest first. Readiness is filled in only when `studentId` is given (it is that student's own). */
export async function classAssessments(classroomId: string, today: string, studentId?: string, opts: { from?: string; take?: number } = {}): Promise<AssessmentRow[]> {
  const rows = await db.assessment.findMany({
    where: { classroomId, ...(opts.from ? { date: { gte: new Date(`${opts.from}T00:00:00.000Z`) } } : {}) },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: opts.take ?? 300,
    include: { pattern: { select: { id: true, name: true } }, subject: { select: { name: true, color: true } }, chapters: { select: { chapter: { select: { id: true, name: true, position: true } } } } },
  });
  const percents = studentId ? await chapterPercents(studentId, [...new Set(rows.flatMap((r) => r.chapters.map((c) => c.chapter.id)))]) : new Map<string, number | null>();
  return rows.map((r) => {
    const chapters = r.chapters.map((c) => c.chapter).sort((a, b) => a.position - b.position).map((c) => ({ id: c.id, name: c.name, percent: percents.get(c.id) ?? null }));
    const ready = studentId ? assessmentReadiness(chapters.map((c) => c.percent)) : { percent: null, level: "NOT_STARTED" as const };
    const date = dateToKey(r.date);
    return { id: r.id, kind: r.kind, title: r.title, date, days: daysBetween(today, date), subjectId: r.subjectId, subjectName: r.subject.name, subjectColor: r.subject.color, chapters, pattern: r.pattern, ...ready };
  });
}

/** Reminders are worked out when a page loads from the dates and the student's own quizzes, so there is nothing to schedule or send. */
export const REMINDER_DAYS = 7;

export async function upcomingFor(studentId: string, classroomId: string, today: string) {
  const rows = await classAssessments(classroomId, today, studentId, { from: today, take: 20 });
  return rows.filter((r) => r.days <= REMINDER_DAYS);
}

export type MaterialCount = { cardsApproved: number; cardsDraft: number; questionsApproved: number; questionsDraft: number; mcqApproved: number; mcqDraft: number };

/** Chapter ids → how many APPROVED / DRAFT flashcards, written questions and multiple-choice questions. */
export async function materialCounts(chapterIds: string[]) {
  const [cards, questions, mcqs] = await Promise.all([
    db.flashcard.groupBy({ by: ["chapterId", "status"], where: { chapterId: { in: chapterIds } }, _count: true }),
    db.question.groupBy({ by: ["chapterId", "status"], where: { chapterId: { in: chapterIds } }, _count: true }),
    db.mcqQuestion.groupBy({ by: ["chapterId", "status"], where: { chapterId: { in: chapterIds } }, _count: true }),
  ]);
  const out = new Map<string, MaterialCount>();
  const row = (id: string) => out.get(id) ?? out.set(id, { cardsApproved: 0, cardsDraft: 0, questionsApproved: 0, questionsDraft: 0, mcqApproved: 0, mcqDraft: 0 }).get(id)!;
  for (const c of cards) row(c.chapterId)[c.status === "APPROVED" ? "cardsApproved" : "cardsDraft"] = c._count;
  for (const q of questions) row(q.chapterId)[q.status === "APPROVED" ? "questionsApproved" : "questionsDraft"] = q._count;
  for (const m of mcqs) row(m.chapterId)[m.status === "APPROVED" ? "mcqApproved" : "mcqDraft"] = m._count;
  return out;
}
