"use server";

import { Prisma } from "@prisma/client";
import { XP } from "@/lib/game";
import { awardQuietly } from "@/lib/game-server";
import { CONFIDENCES, type Confidence } from "@/lib/confidence";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";
import { requireMember, requireTeacher } from "@/lib/access";
import { generateMcqs } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { norm, type McqInput, type MisconceptionInput } from "@/lib/mcq-schema";
import { pickForTrap } from "@/lib/mistakes";
import { pickQuestions, shuffle } from "@/lib/quiz";
import { record, tooMany } from "@/lib/rate-limit";
import { MIN_NOTE_CHARS, StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

const done = () => revalidatePath("/", "layout");
const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);

/* ------------------------------------------------------------------ teachers: make and check questions */

async function chapterContext(chapterId: string) {
  const c = await db.chapter.findUnique({ where: { id: chapterId }, select: { id: true, name: true, subject: { select: { id: true, name: true, classroomId: true, classroom: { select: { grade: true } } } } } });
  if (!c) throw new UserError("Chapter not found.");
  return { id: c.id, name: c.name, subjectId: c.subject.id, subjectName: c.subject.name, classroomId: c.subject.classroomId, grade: c.subject.classroom.grade };
}

async function checkDailyLimit() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");
}

const aiError = (e: unknown) => {
  if (e instanceof StudyOutputError) return new UserError(`${e.message} Please try again.`);
  if (e instanceof OpenAI.APIError) return new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
  return e;
};

/** Saves new misconceptions (matched to the subject's existing ones by name) and the questions as drafts. */
async function saveMcqs(subjectId: string, chapterId: string, noteId: string | null, out: { misconceptions: MisconceptionInput[]; questions: McqInput[] }, by?: { userId: string; student: boolean }) {
  const existing = await db.misconception.findMany({ where: { subjectId }, select: { id: true, label: true } });
  const idByLabel = new Map(existing.map((m) => [norm(m.label), m.id]));
  for (const m of out.misconceptions) {
    if (idByLabel.has(norm(m.label))) continue;
    const created = await db.misconception.create({ data: { subjectId, label: m.label, fix: m.fix } });
    idByLabel.set(norm(m.label), created.id);
  }
  const ids: string[] = [];
  for (const q of out.questions) {
    const tags = q.tags.map((t, choiceIndex) => ({ choiceIndex, misconceptionId: t ? idByLabel.get(norm(t)) : undefined })).filter((t): t is { choiceIndex: number; misconceptionId: string } => !!t.misconceptionId);
    if (tags.length === 0) continue;
    const created = await db.mcqQuestion.create({
      data: { chapterId, noteId, stem: q.stem, choices: JSON.stringify(q.choices), answerIndex: q.answerIndex, explanation: q.explanation, distractors: { create: tags },
        createdById: by?.userId ?? null, source: by?.student ? "STUDENT" : "AI" },
    });
    ids.push(created.id);
  }
  return ids;
}

/** Makes Mistake Map questions from ONE approved note (one short AI call; the browser calls it once per note). */
const countSchema = z.number().int().min(1).max(15).optional();

/** `count`: how many questions the teacher wants from this note (leave out for an amount that suits the notes). */
export async function generateNoteMcqs(noteId: string, replace = false, count?: number) {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({ where: { id: noteId }, select: { status: true, text: true, classroomId: true, chapterId: true, images: { orderBy: { position: "asc" }, select: { transcript: true } } } });
    if (!note) throw new UserError("Note not found.");
    await requireTeacher(userId, note.classroomId);
    if (note.status !== "APPROVED") throw new UserError("Only approved notes can be used.");
    if (!note.chapterId) throw new UserError("File this note under a chapter first.");
    if (!aiEnabled()) throw new UserError("AI is off, so nothing was generated.");
    const text = [note.text, ...note.images.map((i) => i.transcript)].filter(Boolean).join("\n\n");
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("This note doesn't have enough written text yet.");
    if (!replace && (await db.mcqQuestion.count({ where: { noteId } })) > 0) throw new UserError("This note already has multiple-choice questions. Use Regenerate to replace them.");
    await checkDailyLimit();

    const ctx = await chapterContext(note.chapterId);
    const existing = (await db.misconception.findMany({ where: { subjectId: ctx.subjectId }, select: { label: true } })).map((m) => m.label);
    const record = (i: number, o: number) => db.aiUsage.create({ data: { classroomId: note.classroomId, model: "mcq", kind: "STUDY", inputTokens: i, outputTokens: o } });
    let out;
    try {
      out = await generateMcqs({ grade: ctx.grade, subject: ctx.subjectName, chapter: ctx.name, text, existing, count: countSchema.parse(count) });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await record(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
      throw aiError(e);
    }
    await record(out.inputTokens, out.outputTokens);
    if (replace) await db.mcqQuestion.deleteMany({ where: { noteId, source: "AI" } });
    const saved = await saveMcqs(ctx.subjectId, ctx.id, noteId, out, { userId, student: false });
    done();
    return { questions: saved.length };
  });
}

/** Makes a few questions aimed at ONE misconception, from the approved notes of the chapter it appears in most. */
export async function generateTrapMcqs(misconceptionId: string, count = 4) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.misconception.findUnique({ where: { id: misconceptionId }, select: { id: true, label: true, fix: true, subjectId: true, subject: { select: { classroomId: true } } } });
    if (!m) throw new UserError("That misconception no longer exists.");
    await requireTeacher(userId, m.subject.classroomId);
    if (!aiEnabled()) throw new UserError("AI is off, so nothing was generated.");
    await checkDailyLimit();

    const where = await db.mcqQuestion.groupBy({ by: ["chapterId"], where: { distractors: { some: { misconceptionId } } }, _count: true });
    const chapterId = where.sort((a, b) => b._count - a._count)[0]?.chapterId;
    if (!chapterId) throw new UserError("No questions use this misconception yet, so there's no chapter to draw from.");
    const ctx = await chapterContext(chapterId);
    const notes = await db.note.findMany({ where: { chapterId, status: "APPROVED" }, orderBy: { lessonDate: "asc" }, select: { text: true, images: { select: { transcript: true } } } });
    const text = notes.flatMap((n) => [n.text, ...n.images.map((i) => i.transcript)]).filter(Boolean).join("\n\n");
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("That chapter doesn't have enough approved note text.");
    const existing = (await db.misconception.findMany({ where: { subjectId: m.subjectId }, select: { label: true } })).map((x) => x.label);

    const record = (i: number, o: number) => db.aiUsage.create({ data: { classroomId: ctx.classroomId, model: "mcq", kind: "STUDY", inputTokens: i, outputTokens: o } });
    let out;
    try {
      out = await generateMcqs({ grade: ctx.grade, subject: ctx.subjectName, chapter: ctx.name, text, existing, target: { label: m.label, fix: m.fix }, count: z.number().int().min(1).max(15).parse(count) });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await record(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
      throw aiError(e);
    }
    await record(out.inputTokens, out.outputTokens);
    const saved = await saveMcqs(m.subjectId, chapterId, null, out, { userId, student: false });
    done();
    return { questions: saved.length, chapterId };
  });
}

async function mcqClass(id: string) {
  const q = await db.mcqQuestion.findUnique({ where: { id }, select: { chapter: { select: { subject: { select: { classroomId: true } } } } } });
  if (!q) throw new UserError("That question no longer exists.");
  return q.chapter.subject.classroomId;
}

/**
 * Approves one draft. Teachers and (by the product owner's choice, 2026-11-15) students of the class can do this;
 * who did it is recorded so the teacher sees "Approved by a student" and can still delete the question.
 * Generating for the class, deleting and approving everything at once stay teacher-only.
 */
export async function approveMcq(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    const access = await requireMember(userId, await mcqClass(id));
    const r = await db.mcqQuestion.updateMany({ where: { id, status: "DRAFT" }, data: { status: "APPROVED", approvedByRole: access.role, approvedById: userId } });
    if (r.count === 0) throw new UserError("Someone already approved this question.");
    done();
  });
}

export async function deleteMcq(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, await mcqClass(id));
    await db.mcqQuestion.delete({ where: { id } });
    done();
  });
}

export async function approveChapterMcqs(chapterId: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, (await chapterContext(chapterId)).classroomId);
    const r = await db.mcqQuestion.updateMany({ where: { chapterId, status: "DRAFT" }, data: { status: "APPROVED", approvedByRole: "TEACHER", approvedById: userId } });
    done();
    return { approved: r.count };
  });
}

/* ------------------------------------------------------------------ students: practise */

type Item = { id: string; perm: number[] };
export type McqView = { stem: string; choices: string[] };

/**
 * Starts a practice set: a chapter's questions (fresh ones first), or questions that set a trap for one
 * misconception (never-seen first, then ones the student fell for). Approved questions only.
 */
export async function startMcqPractice(target: { chapterId?: string; misconceptionId?: string }) {
  return run(async () => {
    const userId = await requireUserId();
    const t = z.object({ chapterId: z.string().min(1).optional(), misconceptionId: z.string().min(1).optional() }).refine((x) => !!x.chapterId !== !!x.misconceptionId).parse(target);
    let ids: string[];
    if (t.chapterId) {
      const ctx = await chapterContext(t.chapterId);
      await requireMember(userId, ctx.classroomId);
      const pool = await db.mcqQuestion.findMany({ where: { chapterId: t.chapterId, status: "APPROVED" }, select: { id: true, noteId: true } });
      if (pool.length === 0) throw new UserError("There are no practice questions for this chapter yet.");
      const seen = new Set((await db.mcqAnswer.findMany({ where: { userId, question: { chapterId: t.chapterId } }, select: { questionId: true } })).map((a) => a.questionId));
      ids = pickQuestions(pool, seen, 8);
    } else {
      const m = await db.misconception.findUnique({ where: { id: t.misconceptionId! }, select: { subject: { select: { classroomId: true } } } });
      if (!m) throw new UserError("That trap no longer exists.");
      await requireMember(userId, m.subject.classroomId);
      const pool = await db.mcqQuestion.findMany({ where: { status: "APPROVED", distractors: { some: { misconceptionId: t.misconceptionId } } }, select: { id: true } });
      if (pool.length === 0) throw new UserError("There are no practice questions for this trap yet. Your teacher can make some.");
      const past = await db.mcqAnswer.findMany({ where: { userId, questionId: { in: pool.map((p) => p.id) } }, orderBy: { createdAt: "asc" }, select: { questionId: true, misconceptionId: true } });
      const history = new Map(past.map((a) => [a.questionId, a.misconceptionId === t.misconceptionId ? ("fell" as const) : ("avoided" as const)]));
      ids = pickForTrap(pool, history, 5);
    }
    const items: Item[] = ids.map((id) => ({ id, perm: shuffle([0, 1, 2, 3]) }));
    const session = await db.mcqSession.create({ data: { userId, chapterId: t.chapterId ?? null, misconceptionId: t.misconceptionId ?? null, items: JSON.stringify(items) } });
    const rows = new Map((await db.mcqQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, stem: true, choices: true } })).map((q) => [q.id, q]));
    const questions: McqView[] = items.map((it) => {
      const q = rows.get(it.id)!;
      const choices = JSON.parse(q.choices) as string[];
      return { stem: q.stem, choices: it.perm.map((p) => choices[p]) };
    });
    return { sessionId: session.id, questions };
  });
}

/**
 * Records one answer, with how sure the student said they were (asked before they see the result), and says
 * whether it was right; if not, names the trap and the correct idea. Confidence stays with the student's answer.
 */
export async function answerMcq(sessionId: string, position: number, chosen: number, confidence?: Confidence | null) {
  return run(async () => {
    const userId = await requireUserId();
    const session = await db.mcqSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.kind !== "practice") throw new UserError("Practice set not found.");
    const items = JSON.parse(session.items) as Item[];
    const pos = z.number().int().min(0).max(items.length - 1).parse(position);
    const pick = z.number().int().min(0).max(3).parse(chosen);
    const sure = z.enum(CONFIDENCES).nullish().parse(confidence) ?? null;
    const item = items[pos];
    const q = await db.mcqQuestion.findUnique({ where: { id: item.id }, include: { chapter: { select: { subject: { select: { classroomId: true } } } }, distractors: { include: { misconception: { select: { id: true, label: true, fix: true } } } } } });
    if (!q) throw new UserError("This question was removed by your teacher. Skip to the next one.");
    await requireMember(userId, q.chapter.subject.classroomId);

    const original = item.perm[pick];
    const correct = original === q.answerIndex;
    const trap = correct ? null : q.distractors.find((d) => d.choiceIndex === original)?.misconception ?? null;
    try {
      await db.mcqAnswer.create({ data: { sessionId, position: pos, userId, questionId: q.id, chosenIndex: original, correct, misconceptionId: trap?.id ?? null, confidence: sure } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new UserError("You've already answered this one.");
      throw e;
    }
    // Practising counts towards the streak; a right answer earns XP. A game problem never breaks practice.
    await awardQuietly(userId, { xp: correct ? XP.practiceRight : 0, once: `mcq:${sessionId}:${pos}` });
    return { correct, correctPosition: item.perm.indexOf(q.answerIndex), explanation: q.explanation, trap: trap ? { id: trap.id, label: trap.label, fix: trap.fix } : null };
  });
}

/* ------------------------------------------------------------------ students make their own practice questions */

/** Teacher: how many questions a student gets when they ask for new ones (0 turns it off). */
export async function setStudentQuestionCount(classroomId: string, count: number) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, classroomId);
    const n = z.number().int().min(0).max(15).parse(count);
    await db.classroom.update({ where: { id: classroomId }, data: { studentQuestionCount: n } });
    done();
    return { count: n };
  });
}

/**
 * A student asks for new multiple-choice questions on a chapter. The AI makes them from the chapter's approved
 * notes (nothing about the student is sent); the student practises them straight away, and they're saved as drafts
 * the teacher (or classmates) can approve for everyone. How many: the teacher's class setting.
 */
export async function generateStudentMcqs(chapterId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const ctx = await chapterContext(chapterId);
    await requireMember(userId, ctx.classroomId);
    const count = (await db.classroom.findUniqueOrThrow({ where: { id: ctx.classroomId }, select: { studentQuestionCount: true } })).studentQuestionCount;
    if (count <= 0) throw new UserError("Your teacher has turned off making new questions for this class.");
    if (!aiEnabled()) throw new UserError("AI is off, so new questions can't be made right now.");
    if (tooMany(`mcqgen:${userId}`, 5, 3_600_000)) throw new UserError("You've made a lot of questions in the last hour. Practise these first, then try again later.");
    await checkDailyLimit();
    const notes = await db.note.findMany({ where: { chapterId, status: "APPROVED" }, orderBy: [{ lessonDate: "asc" }, { createdAt: "asc" }], select: { text: true, images: { select: { transcript: true } } } });
    const text = notes.flatMap((n) => [n.text, ...n.images.map((i) => i.transcript)]).filter(Boolean).join("\n\n");
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("This chapter doesn't have enough approved notes to make questions from yet.");
    const existing = (await db.misconception.findMany({ where: { subjectId: ctx.subjectId }, select: { label: true } })).map((m) => m.label);

    record(`mcqgen:${userId}`);
    const usage = (i: number, o: number) => db.aiUsage.create({ data: { classroomId: ctx.classroomId, model: "mcq", kind: "STUDY", inputTokens: i, outputTokens: o } });
    let out;
    try {
      out = await generateMcqs({ grade: ctx.grade, subject: ctx.subjectName, chapter: ctx.name, text, existing, count });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await usage(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
      throw aiError(e);
    }
    await usage(out.inputTokens, out.outputTokens);
    const ids = await saveMcqs(ctx.subjectId, chapterId, null, out, { userId, student: true });
    if (ids.length === 0) throw new UserError("The AI didn't make usable questions this time. Please try again.");

    // Start a practice set with exactly these new questions.
    const items: Item[] = ids.map((id) => ({ id, perm: shuffle([0, 1, 2, 3]) }));
    const session = await db.mcqSession.create({ data: { userId, chapterId, items: JSON.stringify(items) } });
    const rows = new Map((await db.mcqQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, stem: true, choices: true } })).map((q) => [q.id, q]));
    const questions: McqView[] = items.map((it) => {
      const q = rows.get(it.id)!;
      const choices = JSON.parse(q.choices) as string[];
      return { stem: q.stem, choices: it.perm.map((p) => choices[p]) };
    });
    done();
    return { sessionId: session.id, questions };
  });
}
