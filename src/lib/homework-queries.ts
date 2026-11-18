import "server-only";
import { db } from "./db";
import type { HwMarks, HwQuestion } from "./homework";

const parse = <T,>(s: string | null, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

/** The class's homework: sheets (students see only published ones), with handed-in and marked counts and averages. */
export async function homeworkList(classroomId: string, userId: string, teacher: boolean) {
  const sheets = await db.homeworkSheet.findMany({
    where: { classroomId, ...(teacher ? {} : { publishedAt: { not: null } }) },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, publishedAt: true, createdAt: true, questions: true, chapter: { select: { name: true } }, work: { select: { userId: true, submittedAt: true, markStatus: true, total: true, outOf: true, marks: true } } },
  });
  return sheets.map((s) => {
    const qs = parse<HwQuestion[]>(s.questions, []);
    const confirmed = s.work.filter((w) => w.markStatus === "CONFIRMED" && w.outOf);
    const mine = s.work.find((w) => w.userId === userId);
    return {
      id: s.id, title: s.title, chapter: s.chapter?.name ?? null, published: !!s.publishedAt, questions: qs.length, outOf: qs.reduce((n, q) => n + q.marks, 0),
      handedIn: s.work.filter((w) => w.submittedAt).length, marked: confirmed.length,
      average: confirmed.length ? Math.round((confirmed.reduce((n, w) => n + (w.total ?? 0) / (w.outOf ?? 1), 0) / confirmed.length) * 100) : null,
      mine: mine ? { submitted: !!mine.submittedAt, confirmed: mine.markStatus === "CONFIRMED", total: mine.markStatus === "CONFIRMED" ? mine.total : null } : null,
      weak: confirmed.flatMap((w) => parse<HwMarks | null>(w.marks, null)?.weak ?? []),
      perStudent: confirmed.map((w) => ({ userId: w.userId, title: s.title, total: w.total ?? 0, outOf: w.outOf ?? 0, weak: parse<HwMarks | null>(w.marks, null)?.weak ?? [] })),
    };
  });
}
