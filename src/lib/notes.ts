import "server-only";
import { can, getClassAccess, type ClassRole } from "./access";
import { UserError } from "./action";
import { db } from "./db";
import type { ClassKind, Power } from "./powers";

type NoteAccess = { kind: ClassKind; role: ClassRole; powers: readonly Power[] };

/** Who reviews, hides and un-hides notes: a classroom's teachers; in a student room, whoever has the moderate power. */
export const canManageNotes = (access: NoteAccess) => (access.kind === "CLASS" ? access.role === "TEACHER" : can(access, "moderate"));

/**
 * Visibility rules:
 *  - APPROVED notes: everyone in the class
 *  - PENDING / REJECTED (hidden) notes: only the author and whoever manages notes
 */
export function canView(note: { status: string; authorId: string }, access: NoteAccess, userId: string) {
  return note.status === "APPROVED" || canManageNotes(access) || note.authorId === userId;
}
/** Editing: the author, or a classroom teacher. Room moderators hide notes; they don't rewrite them. */
export const canEdit = (note: { authorId: string }, access: NoteAccess, userId: string) => note.authorId === userId || (access.kind === "CLASS" && access.role === "TEACHER");
export const canDelete = (note: { authorId: string }, access: NoteAccess, userId: string) => canEdit(note, access, userId) || canManageNotes(access);

/** Loads a note the user is allowed to see, or null (same result for "missing" and "hidden"). */
export async function getVisibleNote(userId: string, noteId: string) {
  const note = await db.note.findUnique({ where: { id: noteId } });
  if (!note) return null;
  const access = await getClassAccess(userId, note.classroomId);
  if (!access || !canView(note, access, userId)) return null;
  return { note, access };
}

export async function requireVisibleNote(userId: string, noteId: string) {
  const r = await getVisibleNote(userId, noteId);
  if (!r) throw new UserError("Note not found.");
  return r;
}

/** Subject must belong to the class; chapter (optional) must belong to the subject. */
export async function checkPlacement(classroomId: string, subjectId: string, chapterId: string | null) {
  const subject = await db.subject.findFirst({ where: { id: subjectId, classroomId }, select: { id: true } });
  if (!subject) throw new UserError("Choose a subject from this class.");
  if (chapterId) {
    const chapter = await db.chapter.findFirst({ where: { id: chapterId, subjectId }, select: { id: true } });
    if (!chapter) throw new UserError("That chapter isn't in the chosen subject.");
  }
}

/** The teacher can always add notes; students only when the teacher has approved them ("Can upload"). */
export function canUpload(access: { role: ClassRole; membership: { canUpload: boolean } | null }) {
  return access.role === "TEACHER" || !!access.membership?.canUpload;
}

export function requireUploadRight(access: { role: ClassRole; membership: { canUpload: boolean } | null }) {
  if (!canUpload(access)) throw new UserError("Your teacher hasn't allowed you to add notes yet. Ask your teacher if you'd like to share yours.");
}
