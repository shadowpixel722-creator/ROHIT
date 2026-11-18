"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher, requireTeacherOfChapter, requireTeacherOfSubject } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { SUBJECT_COLOR_KEYS } from "@/lib/constants";
import { db } from "@/lib/db";
import { chapterSchema, subjectSchema } from "@/lib/validation";
import { ncertChapters } from "@/data/ncert-index";

const done = () => revalidatePath("/", "layout");

const sourceLabel = (books: { code: string; title: string; edition: string }[]) =>
  "NCERT " + books.map((b) => `${b.title} (${b.code})`).join(" + ") + `, ${books[0].edition}`;

/** Adds index chapters that the subject doesn't have yet (matched case-insensitively). */
async function addIndexChapters(subjectId: string, chapters: string[]) {
  const existing = await db.chapter.findMany({ where: { subjectId }, select: { name: true } });
  const have = new Set(existing.map((e) => e.name.toLowerCase()));
  const fresh = chapters.filter((c) => !have.has(c.toLowerCase()));
  if (fresh.length) await db.chapter.createMany({ data: fresh.map((name, i) => ({ subjectId, name, position: existing.length + i })) });
  return fresh.length;
}

export async function addSubject(classroomId: string, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const { classroom } = await requireTeacher(userId, classroomId);
    const d = subjectSchema.parse(input);
    const existing = await db.subject.findMany({ where: { classroomId }, select: { name: true } });
    if (existing.length >= 30) throw new UserError("A class can have up to 30 subjects.");
    if (existing.some((e) => e.name.toLowerCase() === d.name.toLowerCase())) throw new UserError(`This class already has “${d.name}”.`);
    // Chapters come from the NCERT index for this class, when one exists.
    const index = ncertChapters(classroom.grade, d.name);
    const subject = await db.subject.create({
      data: { classroomId, name: d.name, color: d.color ?? SUBJECT_COLOR_KEYS[existing.length % SUBJECT_COLOR_KEYS.length], position: existing.length, indexSource: index ? sourceLabel(index.books) : null },
    });
    const added = index ? await addIndexChapters(subject.id, index.chapters) : 0;
    done();
    return { chapters: added };
  });
}

/** Loads (or tops up) the NCERT chapter list for an existing subject. */
export async function loadNcertChapters(subjectId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await requireTeacherOfSubject(userId, subjectId);
    const [subject, classroom] = await Promise.all([
      db.subject.findUniqueOrThrow({ where: { id: subjectId }, select: { name: true } }),
      db.classroom.findUniqueOrThrow({ where: { id: s.classroomId }, select: { grade: true } }),
    ]);
    if (!classroom.grade) throw new UserError("Set the class (e.g. Class 8) in Class settings first.");
    const index = ncertChapters(classroom.grade, subject.name);
    if (!index) throw new UserError(`No NCERT chapter list is bundled for Class ${classroom.grade} ${subject.name}. Add chapters yourself.`);
    const added = await addIndexChapters(subjectId, index.chapters);
    await db.subject.update({ where: { id: subjectId }, data: { indexSource: sourceLabel(index.books) } });
    done();
    return { added };
  });
}

export async function updateSubject(id: string, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await requireTeacherOfSubject(userId, id);
    const d = subjectSchema.partial().parse(input);
    if (d.name) {
      const clash = await db.subject.findMany({ where: { classroomId: s.classroomId, NOT: { id } }, select: { name: true } });
      if (clash.some((c) => c.name.toLowerCase() === d.name!.toLowerCase())) throw new UserError(`This class already has “${d.name}”.`);
    }
    await db.subject.update({ where: { id }, data: { ...(d.name ? { name: d.name } : {}), ...(d.color ? { color: d.color } : {}) } });
    done();
  });
}

export async function deleteSubject(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacherOfSubject(userId, id);
    await db.subject.delete({ where: { id } });
    done();
  });
}

/** Adds one chapter per non-empty line (so a teacher can paste the textbook's contents page). */
export async function addChapters(subjectId: string, text: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacherOfSubject(userId, subjectId);
    if (typeof text !== "string" || text.length > 20_000) throw new UserError("That's too much text.");
    const names = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:chapter|ch\.?|unit|lesson)?\s*\d*\s*[.:)\-–]?\s*/i, "").trim())
      .filter(Boolean)
      .map((n) => chapterSchema.parse({ name: n }).name);
    if (!names.length) throw new UserError("Enter at least one chapter name.");
    const existing = await db.chapter.findMany({ where: { subjectId }, select: { name: true } });
    const known = new Set(existing.map((e) => e.name.toLowerCase()));
    const fresh = [...new Map(names.filter((n) => !known.has(n.toLowerCase())).map((n) => [n.toLowerCase(), n])).values()];
    if (existing.length + fresh.length > 100) throw new UserError("A subject can have up to 100 chapters.");
    await db.chapter.createMany({ data: fresh.map((name, i) => ({ subjectId, name, position: existing.length + i })) });
    done();
    return { added: fresh.length, skipped: names.length - fresh.length };
  });
}

/** Teachers can rename, reorder and delete any chapter, including ones loaded from the NCERT list
 *  ("Add missing NCERT chapters" brings a removed one back). Names stay unique within a subject. */
export async function renameChapter(id: string, name: string) {
  return run(async () => {
    const userId = await requireUserId();
    const c = await requireTeacherOfChapter(userId, id);
    const data = chapterSchema.parse({ name });
    const others = await db.chapter.findMany({ where: { subjectId: c.subjectId, NOT: { id } }, select: { name: true } });
    if (others.some((o) => o.name.toLowerCase() === data.name.toLowerCase())) throw new UserError(`This subject already has a chapter called “${data.name}”.`);
    await db.chapter.update({ where: { id }, data });
    done();
  });
}

/**
 * Deletes a chapter. Its notes stay in the notebook (filed with no chapter); its flashcards, quiz
 * questions and quiz results go with it, and it is removed from any test or exam that covered it.
 */
export async function deleteChapter(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacherOfChapter(userId, id);
    await db.chapter.delete({ where: { id } });
    done();
  });
}

export async function moveChapter(id: string, direction: "up" | "down") {
  return run(async () => {
    const userId = await requireUserId();
    const c = await requireTeacherOfChapter(userId, id);
    const all = await db.chapter.findMany({ where: { subjectId: c.subjectId }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true } });
    const i = all.findIndex((x) => x.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    await db.$transaction(all.map((x, position) => db.chapter.update({ where: { id: x.id }, data: { position } })));
    done();
  });
}
