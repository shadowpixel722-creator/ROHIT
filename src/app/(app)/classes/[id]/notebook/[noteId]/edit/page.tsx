import { notFound } from "next/navigation";
import { NoteForm } from "@/components/notes/note-form";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formSubjects, imageSrc } from "@/lib/note-queries";
import { canEdit, canUpload, getVisibleNote } from "@/lib/notes";

export const metadata = { title: "Edit note" };

export default async function EditNotePage({ params }: { params: Promise<{ id: string; noteId: string }> }) {
  const { id, noteId } = await params;
  const user = await requireUser();
  const r = await getVisibleNote(user.id, noteId);
  if (!r || r.note.classroomId !== id || !canEdit(r.note, r.access.role, user.id)) notFound();
  const teacher = r.access.role === "TEACHER";
  if (!canUpload(r.access)) notFound(); // editing can add pages, so it needs upload permission
  const [subjects, images, attachments] = await Promise.all([
    formSubjects(id),
    db.noteImage.findMany({ where: { noteId }, orderBy: { position: "asc" }, select: { id: true, width: true, height: true, size: true } }),
    db.noteAttachment.findMany({ where: { noteId }, orderBy: { position: "asc" }, select: { id: true, fileName: true, size: true } }),
  ]);
  const n = r.note;
  return (
    <NoteForm classroomId={id} subjects={subjects} teacher={teacher}
      note={{ id: n.id, title: n.title, text: n.text ?? "", subjectId: n.subjectId, chapterId: n.chapterId ?? "", lessonDate: n.lessonDate ? n.lessonDate.toISOString().slice(0, 10) : n.createdAt.toISOString().slice(0, 10), status: n.status, images: images.map((i) => ({ id: i.id, src: imageSrc(i) })), attachments }} />
  );
}
