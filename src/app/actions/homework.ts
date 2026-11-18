"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";
import { requireMember, requireTeacher } from "@/lib/access";
import { markHomework, writeHomework } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText } from "@/lib/explain-schema";
import { awardQuietly } from "@/lib/game-server";
import { MAX_HW_ANSWER, totalOf, type HwMarks, type HwQuestion } from "@/lib/homework";
import { cleanPhoto, MAX_PHOTO_BYTES } from "@/lib/photo";
import { StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);
const parse = <T,>(s: string | null, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };
const done = (classroomId: string) => revalidatePath(`/classes/${classroomId}/homework`, "layout");

async function sheetFor(sheetId: string) {
  const s = await db.homeworkSheet.findUnique({ where: { id: sheetId }, include: { classroom: { select: { grade: true } } } });
  if (!s) throw new UserError("Homework not found.");
  return s;
}
async function aiGuard(classroomId: string) {
  if (!aiEnabled()) throw new UserError("AI is off right now.");
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");
  return (i: number, o: number) => db.aiUsage.create({ data: { classroomId, model: "homework", kind: "STUDY", inputTokens: i, outputTokens: o } });
}
async function withAi<T extends { inputTokens: number; outputTokens: number }>(usage: (i: number, o: number) => Promise<unknown>, fn: () => Promise<T>) {
  try { const out = await fn(); await usage(out.inputTokens, out.outputTokens); return out; }
  catch (e) {
    const spent = e as { inputTokens?: number; outputTokens?: number };
    if (spent.inputTokens || spent.outputTokens) await usage(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
    if (e instanceof StudyOutputError) throw new UserError(`${e.message} Please try again.`);
    if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
    throw e;
  }
}

/** Teacher: the AI writes a homework sheet for a chapter from its approved notes. It starts as a draft. */
export async function makeSheet(classroomId: string, input: { chapterId: string; count: number; level: string; note?: string }) {
  return run(async () => {
    const userId = await requireUserId();
    const access = await requireTeacher(userId, classroomId);
    const i = z.object({ chapterId: z.string().min(1), count: z.number().int().min(3).max(15), level: z.enum(["Easy", "Medium", "Exam style"]), note: z.string().max(300).default("") }).parse(input);
    const ch = await db.chapter.findFirst({ where: { id: i.chapterId, subject: { classroomId } }, select: { id: true, name: true, subject: { select: { name: true } } } });
    if (!ch) throw new UserError("Chapter not found.");
    const notes = await db.note.findMany({ where: { classroomId, chapterId: ch.id, status: "APPROVED" }, select: { text: true, images: { orderBy: { position: "asc" }, select: { transcript: true } } } });
    const usage = await aiGuard(classroomId);
    const out = await withAi(usage, () => writeHomework({ grade: access.classroom.grade, subject: ch.subject.name, chapter: ch.name, notes: notes.map(lessonText).join("\n\n"), count: i.count, level: i.level, note: i.note }));
    const sheet = await db.homeworkSheet.create({ data: { classroomId, chapterId: ch.id, title: out.sheet.title, note: i.note.trim(), questions: JSON.stringify(out.sheet.questions), createdById: userId } });
    done(classroomId);
    return { sheetId: sheet.id };
  });
}

const QuestionsSchema = z.array(z.object({ q: z.string().trim().min(2).max(500), marks: z.number().int().min(1).max(10), answer: z.string().max(800) })).min(1).max(20);

/** Teacher: edit a sheet's title, instructions and questions (e.g. remove or reword one). */
export async function updateSheet(sheetId: string, input: { title: string; note: string; questions: HwQuestion[] }) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    await requireTeacher(userId, s.classroomId);
    const i = z.object({ title: z.string().trim().min(1).max(80), note: z.string().max(300), questions: QuestionsSchema }).parse(input);
    await db.homeworkSheet.update({ where: { id: sheetId }, data: { title: i.title, note: i.note.trim(), questions: JSON.stringify(i.questions) } });
    done(s.classroomId);
    return {};
  });
}

/** Teacher: publish a sheet to the class (or take it back). */
export async function publishSheet(sheetId: string, on: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    await requireTeacher(userId, s.classroomId);
    await db.homeworkSheet.update({ where: { id: sheetId }, data: { publishedAt: on ? s.publishedAt ?? new Date() : null } });
    done(s.classroomId);
    return { on };
  });
}

export async function deleteSheet(sheetId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    await requireTeacher(userId, s.classroomId);
    await db.homeworkSheet.delete({ where: { id: sheetId } });
    done(s.classroomId);
    return {};
  });
}

/** Student: save (and optionally hand in) answers to a published sheet. Handing in earns XP once. */
export async function saveAnswers(sheetId: string, answers: string[], submit: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    const access = await requireMember(userId, s.classroomId);
    if (access.role !== "STUDENT") throw new UserError("Only students hand in homework.");
    if (!s.publishedAt) throw new UserError("This homework isn't available.");
    const qs = parse<HwQuestion[]>(s.questions, []);
    const a = z.array(z.string().max(MAX_HW_ANSWER * 2)).length(qs.length).parse(answers).map((x) => x.slice(0, MAX_HW_ANSWER));
    const existing = await db.homeworkWork.findUnique({ where: { sheetId_userId: { sheetId, userId } } });
    if (existing?.markStatus === "CONFIRMED") throw new UserError("This homework has already been marked.");
    await db.homeworkWork.upsert({
      where: { sheetId_userId: { sheetId, userId } },
      create: { sheetId, userId, answers: JSON.stringify(a), submittedAt: submit ? new Date() : null },
      update: { answers: JSON.stringify(a), ...(submit ? { submittedAt: new Date() } : {}) },
    });
    if (submit) await awardQuietly(userId, { xp: 10, once: `homework:${sheetId}` });
    done(s.classroomId);
    return { submitted: submit };
  });
}

/**
 * Teacher: the AI suggests marks for a student, from the answers they typed in the app or from photos of
 * their paper. The student must have a confirmed consent form (their work goes to the AI). The marks wait
 * for the teacher to confirm them; photos are not kept.
 */
export async function markWork(sheetId: string, studentId: string, photos: string[] = []) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    await requireTeacher(userId, s.classroomId);
    const m = await db.membership.findFirst({ where: { classroomId: s.classroomId, userId: studentId, role: "STUDENT", status: "ACTIVE" }, select: { consentVerifiedAt: true } });
    if (!m) throw new UserError("That student isn't in this class.");
    if (!m.consentVerifiedAt) throw new UserError("Confirm this student's consent form first: their work is sent to the AI to be marked.");
    const pics = z.array(z.string().max(MAX_PHOTO_BYTES * 1.4)).max(4).parse(photos);
    const work = await db.homeworkWork.findUnique({ where: { sheetId_userId: { sheetId, userId: studentId } } });
    const typed = work?.submittedAt ? parse<string[] | null>(work.answers, null) : null;
    if (!pics.length && !typed) throw new UserError("The student hasn't handed in answers. Add a photo of their paper instead.");
    const images = await Promise.all(pics.map(cleanPhoto));
    const questions = parse<HwQuestion[]>(s.questions, []);
    const usage = await aiGuard(s.classroomId);
    const out = await withAi(usage, () => markHomework({ grade: s.classroom.grade, questions, answers: pics.length ? null : typed, photos: images }));
    await db.homeworkWork.upsert({
      where: { sheetId_userId: { sheetId, userId: studentId } },
      create: { sheetId, userId: studentId, marks: JSON.stringify(out.marks), total: totalOf(out.marks), outOf: questions.reduce((n, q) => n + q.marks, 0), markStatus: "SUGGESTED", markedAt: new Date() },
      update: { marks: JSON.stringify(out.marks), total: totalOf(out.marks), outOf: questions.reduce((n, q) => n + q.marks, 0), markStatus: "SUGGESTED", markedAt: new Date() },
    });
    done(s.classroomId);
    return out.marks;
  });
}

/** Teacher: confirm (after adjusting, if needed) the suggested marks. Only then does the student see them. */
export async function confirmMarks(sheetId: string, studentId: string, awarded: number[], feedback: string) {
  return run(async () => {
    const userId = await requireUserId();
    const s = await sheetFor(sheetId);
    await requireTeacher(userId, s.classroomId);
    const work = await db.homeworkWork.findUnique({ where: { sheetId_userId: { sheetId, userId: studentId } } });
    const marks = parse<HwMarks | null>(work?.marks ?? null, null);
    if (!work || !marks) throw new UserError("Mark this homework first.");
    const a = z.array(z.number().min(0).max(10)).length(marks.answers.length).parse(awarded);
    const next: HwMarks = { ...marks, feedback: z.string().max(500).parse(feedback).trim() || marks.feedback, answers: marks.answers.map((x, i) => ({ ...x, awarded: Math.min(x.of, Math.round(a[i] * 2) / 2) })) };
    await db.homeworkWork.update({ where: { sheetId_userId: { sheetId, userId: studentId } }, data: { marks: JSON.stringify(next), total: totalOf(next), markStatus: "CONFIRMED", markedAt: new Date() } });
    done(s.classroomId);
    return { total: totalOf(next) };
  });
}
