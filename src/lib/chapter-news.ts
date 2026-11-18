import "server-only";
import { db } from "./db";

const FIRST_VISIT_WINDOW_MS = 14 * 86_400_000;

/** Number of approved notes per chapter that this user hasn't seen yet (excluding their own). */
export async function newNotesByChapter(userId: string, classroomId: string) {
  const [seen, notes] = await Promise.all([
    db.chapterSeen.findMany({ where: { userId, chapter: { subject: { classroomId } } } }),
    db.note.findMany({
      where: { classroomId, status: "APPROVED", chapterId: { not: null }, authorId: { not: userId } },
      select: { chapterId: true, reviewedAt: true, createdAt: true },
    }),
  ]);
  const seenAt = new Map(seen.map((s) => [s.chapterId, s.seenAt.getTime()]));
  const cutoffDefault = Date.now() - FIRST_VISIT_WINDOW_MS;
  const out = new Map<string, number>();
  for (const n of notes) {
    const when = (n.reviewedAt ?? n.createdAt).getTime();
    if (when > (seenAt.get(n.chapterId!) ?? cutoffDefault)) out.set(n.chapterId!, (out.get(n.chapterId!) ?? 0) + 1);
  }
  return out;
}

/** Returns when the user last opened the chapter (or a 14-day window on first visit), then records this visit. */
export async function markChapterSeen(userId: string, chapterId: string) {
  const prev = await db.chapterSeen.findUnique({ where: { userId_chapterId: { userId, chapterId } } });
  await db.chapterSeen.upsert({ where: { userId_chapterId: { userId, chapterId } }, create: { userId, chapterId }, update: { seenAt: new Date() } });
  return prev?.seenAt ?? new Date(Date.now() - FIRST_VISIT_WINDOW_MS);
}
