"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, requireTeacher } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ImageError, MAX_IMAGES_PER_NOTE, processPageImage, removeUploads, rotateStoredImage, saveClassImage } from "@/lib/files";
import { MAX_ATTACHMENTS } from "@/lib/attachment-check";
import { attachmentsFrom, saveAttachments } from "@/lib/attachment-save";
import { canEdit, checkPlacement, requireUploadRight, requireVisibleNote } from "@/lib/notes";
import { aiEnabled, queueNote, queuePage } from "@/lib/transcribe";
import { commentSchema, noteSchema, rejectSchema } from "@/lib/validation";

const done = () => revalidatePath("/", "layout");

/** Processes uploaded photos (metadata removed) and saves them. Cleans up if anything fails. */
async function saveImages(classroomId: string, files: File[], convert: boolean[] = []) {
  const saved: { filePath: string; width: number; height: number; size: number; convert: boolean }[] = [];
  try {
    for (const [i, f] of files.entries()) {
      const img = await processPageImage(Buffer.from(await f.arrayBuffer()), f.name || "photo");
      saved.push({ filePath: await saveClassImage(classroomId, img.data), width: img.width, height: img.height, size: img.size, convert: convert[i] ?? true });
    }
    return saved;
  } catch (e) {
    await removeUploads(saved.map((s) => s.filePath));
    if (e instanceof ImageError) throw new UserError(e.message);
    throw e;
  }
}

const filesFrom = (form: FormData) => form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
/** "1"/"0" per uploaded file, in the same order: convert that page to text or not. */
const convertFlags = (form: FormData) => form.getAll("convert").map((v) => String(v) !== "0");

export async function createNote(form: FormData) {
  return run(async () => {
    const userId = await requireUserId();
    const classroomId = String(form.get("classroomId") ?? "");
    const access = await requireMember(userId, classroomId);
    const { role } = access;
    requireUploadRight(access);
    const d = noteSchema.parse({ title: form.get("title"), text: form.get("text") ?? undefined, subjectId: form.get("subjectId"), chapterId: form.get("chapterId") ?? undefined, lessonDate: form.get("lessonDate") });
    await checkPlacement(classroomId, d.subjectId, d.chapterId);
    const files = filesFrom(form);
    const attachFiles = attachmentsFrom(form);
    if (files.length > MAX_IMAGES_PER_NOTE) throw new UserError(`Add up to ${MAX_IMAGES_PER_NOTE} pages per note.`);
    if (attachFiles.length > MAX_ATTACHMENTS) throw new UserError(`Attach up to ${MAX_ATTACHMENTS} files per note.`);
    if (files.length === 0 && attachFiles.length === 0 && !d.text) throw new UserError("Add at least one page photo, typed notes or an attachment.");

    const attachments = await saveAttachments(classroomId, attachFiles);
    let images;
    try {
      images = await saveImages(classroomId, files, convertFlags(form));
    } catch (e) {
      await removeUploads(attachments.map((a) => a.filePath));
      throw e;
    }
    const teacher = role === "TEACHER";
    try {
      const note = await db.note.create({
        data: {
          ...d, classroomId, authorId: userId,
          status: teacher ? "APPROVED" : "PENDING",
          ...(teacher ? { reviewedById: userId, reviewedAt: new Date() } : {}),
          images: { create: images.map((img, position) => ({ ...img, position })) },
          attachments: { create: attachments.map((a, position) => ({ ...a, position })) },
        },
      });
      if (note.status === "APPROVED") await queueNote(note.id); // teacher's own notes: read handwriting now
      done();
      return { id: note.id, status: note.status };
    } catch (e) {
      await removeUploads([...images.map((i) => i.filePath), ...attachments.map((a) => a.filePath)]);
      throw e;
    }
  });
}

/** Edit title/text/placement, add photos, remove photos. A student's edit sends the note back for review. */
export async function updateNote(noteId: string, form: FormData) {
  return run(async () => {
    const userId = await requireUserId();
    const { note, access } = await requireVisibleNote(userId, noteId);
    if (!canEdit(note, access.role, userId)) throw new UserError("You can only edit your own notes.");
    const d = noteSchema.parse({ title: form.get("title"), text: form.get("text") ?? undefined, subjectId: form.get("subjectId"), chapterId: form.get("chapterId") ?? undefined, lessonDate: form.get("lessonDate") });
    // Editing can add pages, so it needs the same permission as uploading. (Deleting your own note never does.)
    requireUploadRight(access);
    await checkPlacement(note.classroomId, d.subjectId, d.chapterId);
    const removeIds = form.getAll("removeImageIds").map(String);
    const existing = await db.noteImage.findMany({ where: { noteId }, orderBy: { position: "asc" } });
    const keep = existing.filter((i) => !removeIds.includes(i.id));
    const files = filesFrom(form);
    const removeAttachmentIds = form.getAll("removeAttachmentIds").map(String);
    const existingAttachments = await db.noteAttachment.findMany({ where: { noteId }, orderBy: { position: "asc" } });
    const keepAttachments = existingAttachments.filter((a) => !removeAttachmentIds.includes(a.id));
    const attachFiles = attachmentsFrom(form);
    if (keep.length + files.length > MAX_IMAGES_PER_NOTE) throw new UserError(`A note can have up to ${MAX_IMAGES_PER_NOTE} pages.`);
    if (keepAttachments.length + attachFiles.length > MAX_ATTACHMENTS) throw new UserError(`A note can have up to ${MAX_ATTACHMENTS} attachments.`);
    if (keep.length + files.length + keepAttachments.length + attachFiles.length === 0 && !d.text) throw new UserError("A note needs at least one page photo, typed notes or an attachment.");

    const addedAttachments = await saveAttachments(note.classroomId, attachFiles);
    let added;
    try {
      added = await saveImages(note.classroomId, files, convertFlags(form));
    } catch (e) {
      await removeUploads(addedAttachments.map((a) => a.filePath));
      throw e;
    }
    const removed = existing.filter((i) => removeIds.includes(i.id));
    const removedAttachments = existingAttachments.filter((a) => removeAttachmentIds.includes(a.id));
    const resubmit = access.role !== "TEACHER";
    try {
      await db.$transaction([
        db.noteImage.deleteMany({ where: { id: { in: removed.map((r) => r.id) }, noteId } }),
        ...keep.map((k, position) => db.noteImage.update({ where: { id: k.id }, data: { position } })),
        db.noteImage.createMany({ data: added.map((a, i) => ({ ...a, noteId, position: keep.length + i })) }),
        db.noteAttachment.deleteMany({ where: { id: { in: removedAttachments.map((r) => r.id) }, noteId } }),
        db.noteAttachment.createMany({ data: addedAttachments.map((a, i) => ({ ...a, noteId, position: keepAttachments.length + i })) }),
        db.note.update({
          where: { id: noteId },
          data: { ...d, ...(resubmit ? { status: "PENDING", rejectReason: null, reviewedById: null, reviewedAt: null } : {}) },
        }),
      ]);
    } catch (e) {
      await removeUploads([...added.map((a) => a.filePath), ...addedAttachments.map((a) => a.filePath)]);
      throw e;
    }
    await removeUploads([...removed.map((r) => r.filePath), ...removedAttachments.map((r) => r.filePath)]);
    if (!resubmit && note.status === "APPROVED") await queueNote(noteId); // new pages added by the teacher
    done();
    return { status: resubmit ? "PENDING" : note.status };
  });
}

export async function deleteNote(noteId: string) {
  const res = await run(async () => {
    const userId = await requireUserId();
    const { note, access } = await requireVisibleNote(userId, noteId);
    if (!canEdit(note, access.role, userId)) throw new UserError("You can only delete your own notes.");
    const [images, attachments] = await Promise.all([
      db.noteImage.findMany({ where: { noteId }, select: { filePath: true } }),
      db.noteAttachment.findMany({ where: { noteId }, select: { filePath: true } }),
    ]);
    await db.note.delete({ where: { id: noteId } });
    await removeUploads([...images, ...attachments].map((i) => i.filePath));
    done();
    return { classroomId: note.classroomId };
  });
  if (res.ok) redirect(`/classes/${res.data!.classroomId}/notebook`);
  return res;
}

export async function reviewNote(noteId: string, decision: "approve" | "reject", reason?: string) {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({ where: { id: noteId }, include: { author: { select: { role: true, name: true } } } });
    if (!note) throw new UserError("Note not found.");
    await requireTeacher(userId, note.classroomId);
    if (decision === "approve") {
      if (note.author.role === "STUDENT") {
        const m = await db.membership.findUnique({ where: { classroomId_userId: { classroomId: note.classroomId, userId: note.authorId } } });
        if (!m) throw new UserError(`${note.author.name} is no longer in this class.`);
        if (!m.consentVerifiedAt) throw new UserError(`Confirm ${note.author.name}'s signed consent form (in the Students list) before sharing their notes with the class.`);
      }
      await db.note.update({ where: { id: noteId }, data: { status: "APPROVED", rejectReason: null, reviewedById: userId, reviewedAt: new Date() } });
      await queueNote(noteId); // only approved pages are ever sent to the AI
    } else {
      const r = rejectSchema.parse({ reason: reason ?? "" });
      await db.note.update({ where: { id: noteId }, data: { status: "REJECTED", rejectReason: r.reason, reviewedById: userId, reviewedAt: new Date() } });
    }
    done();
  });
}

export async function addComment(noteId: string, body: string) {
  return run(async () => {
    const userId = await requireUserId();
    const { note } = await requireVisibleNote(userId, noteId);
    if (note.status !== "APPROVED") throw new UserError("Comments open once the teacher approves the note.");
    const c = commentSchema.parse({ body });
    if ((await db.comment.count({ where: { noteId } })) >= 500) throw new UserError("This note has reached its comment limit.");
    await db.comment.create({ data: { noteId, authorId: userId, body: c.body } });
    done();
  });
}

export async function deleteComment(commentId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const c = await db.comment.findUnique({ where: { id: commentId }, include: { note: { select: { classroomId: true } } } });
    if (!c) throw new UserError("Comment not found.");
    const { role } = await requireMember(userId, c.note.classroomId);
    if (c.authorId !== userId && role !== "TEACHER") throw new UserError("You can only delete your own comments.");
    await db.comment.delete({ where: { id: commentId } });
    done();
  });
}

async function teacherOfImage(userId: string, imageId: string) {
  const img = await db.noteImage.findUnique({ where: { id: imageId }, include: { note: { select: { id: true, classroomId: true, status: true } } } });
  if (!img) throw new UserError("Page not found.");
  await requireTeacher(userId, img.note.classroomId);
  return img;
}

/** Teacher types or corrects a page's text. Teacher text is never overwritten by the AI. */
export async function saveTranscript(imageId: string, text: string) {
  return run(async () => {
    const userId = await requireUserId();
    await teacherOfImage(userId, imageId);
    const t = String(text ?? "").trim().slice(0, 20_000);
    await db.noteImage.update({
      where: { id: imageId },
      data: t ? { transcript: t, transcriptStatus: "DONE", transcriptSource: "TEACHER", transcriptError: null, transcribedAt: new Date() }
              : { transcript: null, transcriptStatus: "NONE", transcriptSource: null, transcriptError: null, transcribedAt: null },
    });
    done();
  });
}

/**
 * Teacher asks the AI to convert a note's pages.
 *  onlyMissing: pages that have no text yet. Otherwise: re-convert all, keeping teacher-checked text.
 */
export async function readNoteAgain(noteId: string, onlyMissing = false) {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({ where: { id: noteId }, select: { classroomId: true, status: true } });
    if (!note) throw new UserError("Note not found.");
    await requireTeacher(userId, note.classroomId);
    if (note.status !== "APPROVED") throw new UserError("Approve the note first. Only approved pages are sent to the AI.");
    if (!aiEnabled()) throw new UserError("AI reading is switched off (no OpenAI API key configured).");
    const n = await queueNote(noteId, { force: !onlyMissing });
    done();
    return { queued: n };
  });
}

/** Turn text conversion on/off for one page (e.g. off for a drawing). Turning it off removes AI text. */
export async function setPageConvert(imageId: string, convert: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const img = await teacherOfImage(userId, imageId);
    await db.noteImage.update({
      where: { id: imageId },
      data: convert ? { convert: true } : { convert: false, ...(img.transcriptSource === "AI" || !img.transcriptSource ? { transcript: null, transcriptStatus: "NONE", transcriptSource: null, transcriptError: null, transcribedAt: null } : {}) },
    });
    if (convert && img.note.status === "APPROVED") await queuePage(imageId);
    done();
  });
}

/** Convert (or re-convert) a single page with the AI. Replaces earlier text, including teacher text. */
export async function convertPage(imageId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const img = await teacherOfImage(userId, imageId);
    if (img.note.status !== "APPROVED") throw new UserError("Approve the note first. Only approved pages are sent to the AI.");
    if (!aiEnabled()) throw new UserError("AI reading is switched off (no OpenAI API key configured).");
    await db.noteImage.update({ where: { id: imageId }, data: { convert: true, transcriptSource: null } });
    await queuePage(imageId);
    done();
  });
}

/** Teacher rotates a stored page by 90° steps (post-scan alignment fix). Text is kept. */
export async function rotatePage(imageId: string, degrees: 90 | 270) {
  return run(async () => {
    const userId = await requireUserId();
    const img = await teacherOfImage(userId, imageId);
    if (degrees !== 90 && degrees !== 270) throw new UserError("Rotate by 90° left or right.");
    const dims = await rotateStoredImage(img.filePath, degrees);
    await db.noteImage.update({ where: { id: imageId }, data: dims });
    done();
  });
}
