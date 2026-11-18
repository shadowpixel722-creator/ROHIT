import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/knowa/lesson-player";
import { Card, EmptyState } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText, textHash, type Explanation } from "@/lib/explain-schema";
import type { Lesson } from "@/lib/knowa/lessons";

export const metadata = { title: "Listen to the lesson" };

/** Turns a lesson's saved explanation into a narrated notepad lesson (no model, no new AI call). */
function toLesson(noteId: string, title: string, ex: Explanation): Lesson {
  const split = (t: string) => (t.match(/[^.!?]+[.!?]*/g) ?? [t]).map((s) => s.trim()).filter(Boolean);
  return {
    id: `note-${noteId}`, model: "", subject: "", title, blurb: ex.summary, chapter: "", classes: [], quiz: [],
    steps: [
      { say: ex.summary, note: { title: "In short", lines: split(ex.summary).slice(0, 4) } },
      ...ex.sections.map((s) => ({ say: `${s.heading}. ${s.explanation}`, note: { title: s.heading, lines: split(s.explanation).slice(0, 5) } })),
      ...(ex.keyPoints.length ? [{ say: `To remember: ${ex.keyPoints.join(". ")}.`, note: { title: "Key points", lines: ex.keyPoints.slice(0, 8) } }] : []),
    ],
  };
}

export default async function ListenPage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const user = await requireUser();
  if (!(await getClassAccess(user.id, id))) notFound();
  const note = await db.note.findFirst({
    where: { id: noteId, classroomId: id, status: "APPROVED" },
    select: { title: true, chapterId: true, text: true, images: { orderBy: { position: "asc" }, select: { transcript: true } }, explanation: true },
  });
  if (!note) notFound();
  const back = note.chapterId ? `/classes/${id}/explain/${note.chapterId}` : `/classes/${id}/explain`;
  const fresh = note.explanation && note.explanation.sourceHash === textHash(lessonText(note)) ? (JSON.parse(note.explanation.content) as Explanation) : null;
  if (!fresh) return <Card><EmptyState title="This lesson hasn't been explained yet" description="Open it on the Explain tab first; then you can listen to it here." /></Card>;
  return <LessonPlayer lesson={toLesson(noteId, note.title, fresh)} backHref={back} backLabel="Back to the chapter" classroomId={id} />;
}
