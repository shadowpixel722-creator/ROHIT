"use server";

import { revalidatePath } from "next/cache";
import { XP } from "@/lib/game";
import { awardQuietly } from "@/lib/game-server";
import { CONFIDENCES, type Confidence } from "@/lib/confidence";
import OpenAI from "openai";
import { z } from "zod";
import { requireMember, requirePower } from "@/lib/access";
import { gradeAnswers, generateStudyMaterial } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getToday } from "@/lib/server";
import { isBlank, MAX_ANSWER_CHARS, MIN_QUIZ_QUESTIONS, noteBreakdown, pickQuestions, pointsOf, quizSize, WEAK_BELOW, type Grade, type QuizQuestionView, type QuizResult } from "@/lib/quiz";
import { tooMany, record } from "@/lib/rate-limit";
import { flashcardSchema, MIN_NOTE_CHARS, questionSchema, StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";
import { assessmentSchema } from "@/lib/validation";
import { keyToDate } from "@/lib/dates";

const done = () => revalidatePath("/", "layout");

/** Safety cap: notes sent to the AI for study material per day, across the whole app. */
const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);

/* ------------------------------------------------------------------ calendar (teachers write, everyone in the class reads) */

async function checkCoverage(classroomId: string, subjectId: string, chapterIds: string[]) {
  const subject = await db.subject.findFirst({ where: { id: subjectId, classroomId }, select: { id: true } });
  if (!subject) throw new UserError("Choose a subject from this class.");
  const unique = [...new Set(chapterIds)];
  const found = await db.chapter.count({ where: { id: { in: unique }, subjectId } });
  if (found !== unique.length) throw new UserError("Choose chapters from the selected subject.");
  return unique;
}

/** The pattern must belong to the same class. */
async function checkPattern(classroomId: string, patternId: string | null) {
  if (!patternId) return null;
  const p = await db.examPattern.findFirst({ where: { id: patternId, classroomId }, select: { id: true } });
  if (!p) throw new UserError("Choose an exam pattern from this class.");
  return p.id;
}

export async function createAssessment(classroomId: string, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    await requirePower(userId, classroomId, "study");
    const d = assessmentSchema.parse(input);
    if (d.date < (await getToday())) throw new UserError("Choose today or a future date.");
    if ((await db.assessment.count({ where: { classroomId } })) >= 300) throw new UserError("A class can have up to 300 dates. Delete old ones first.");
    const chapterIds = await checkCoverage(classroomId, d.subjectId, d.chapterIds);
    const patternId = await checkPattern(classroomId, d.patternId);
    const a = await db.assessment.create({
      data: { classroomId, subjectId: d.subjectId, kind: d.kind, title: d.title, date: keyToDate(d.date), patternId, chapters: { create: chapterIds.map((chapterId) => ({ chapterId })) } },
    });
    done();
    return { id: a.id };
  });
}

export async function updateAssessment(id: string, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const current = await db.assessment.findUnique({ where: { id } });
    if (!current) throw new UserError("That date no longer exists.");
    await requirePower(userId, current.classroomId, "study");
    const d = assessmentSchema.parse(input);
    // Old dates can stay as they are; moving one must land today or later.
    if (keyToDate(d.date).getTime() !== current.date.getTime() && d.date < (await getToday())) throw new UserError("Choose today or a future date.");
    const chapterIds = await checkCoverage(current.classroomId, d.subjectId, d.chapterIds);
    const patternId = await checkPattern(current.classroomId, d.patternId);
    await db.$transaction([
      db.assessmentChapter.deleteMany({ where: { assessmentId: id } }),
      db.assessment.update({
        where: { id },
        data: { subjectId: d.subjectId, kind: d.kind, title: d.title, date: keyToDate(d.date), patternId, chapters: { create: chapterIds.map((chapterId) => ({ chapterId })) } },
      }),
    ]);
    done();
  });
}

export async function deleteAssessment(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    const current = await db.assessment.findUnique({ where: { id }, select: { classroomId: true } });
    if (!current) throw new UserError("That date no longer exists.");
    await requirePower(userId, current.classroomId, "study");
    await db.assessment.delete({ where: { id } });
    done();
  });
}

/* ------------------------------------------------------------------ study material (teachers)  */

async function chapterContext(chapterId: string) {
  const c = await db.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, name: true, subject: { select: { name: true, classroomId: true, classroom: { select: { grade: true } } } } },
  });
  if (!c) throw new UserError("Chapter not found.");
  return { id: c.id, name: c.name, subjectName: c.subject.name, classroomId: c.subject.classroomId, grade: c.subject.classroom.grade };
}

async function studyCallsToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } });
}

/**
 * Makes flashcards and questions from ONE approved note, saved as drafts for the teacher to check.
 * The browser calls this once per note, so each call is short and one failure never loses the others.
 * Only the note's text goes to the AI (see lib/study-schema.ts for exactly what is sent).
 */
const materialKind = z.enum(["flashcards", "questions"]);

/**
 * Makes ONE kind of material from a note: flashcards (Flashcards tab) or written-answer questions (Study tab).
 * `count`: how many the teacher wants (leave out for an amount that suits the notes).
 */
export async function generateNoteMaterial(noteId: string, kind: "flashcards" | "questions", replace = false, count?: number) {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true, status: true, text: true, classroomId: true, chapterId: true,
        images: { orderBy: { position: "asc" }, select: { transcript: true } },
      },
    });
    if (!note) throw new UserError("Note not found.");
    await requirePower(userId, note.classroomId, "study");
    if (note.status !== "APPROVED") throw new UserError("Only approved notes can be used for study material.");
    if (!note.chapterId) throw new UserError("File this note under a chapter first, so its cards and questions belong to a chapter.");
    if (!aiEnabled()) throw new UserError("AI is off, so nothing was generated. You can add items by hand.");

    const text = [note.text, ...note.images.map((i) => i.transcript)].filter(Boolean).join("\n\n");
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("This note doesn't have enough written text yet. If its photos are still being read, try again in a minute.");
    const only = materialKind.parse(kind);
    const n = z.number().int().min(1).max(15).optional().parse(count);
    const existing = only === "flashcards" ? await db.flashcard.count({ where: { noteId } }) : await db.question.count({ where: { noteId } });
    if (existing > 0 && !replace) throw new UserError(`This note already has ${only === "flashcards" ? "flashcards" : "questions"}. Use Regenerate to replace them.`);
    if ((await studyCallsToday()) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow, or add items by hand.");

    const ctx = await chapterContext(note.chapterId);
    const record = (inputTokens: number, outputTokens: number) =>
      db.aiUsage.create({ data: { classroomId: note.classroomId, model: "study", kind: "STUDY", inputTokens, outputTokens } });
    let out;
    try {
      // Ask only for the kind being made (0 of the other).
      out = await generateStudyMaterial({ grade: ctx.grade, subject: ctx.subjectName, chapter: ctx.name, text,
        counts: only === "flashcards" ? { flashcards: n, questions: 0 } : { flashcards: 0, questions: n } });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await record(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
      if (e instanceof StudyOutputError) throw new UserError(`${e.message} Please try again.`);
      if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
      throw e;
    }
    await record(out.inputTokens, out.outputTokens);
    const made = only === "flashcards" ? out.flashcards.length : out.questions.length;
    if (made === 0) throw new UserError(`The AI didn't make any ${only} this time. Please try again.`);
    await db.$transaction(only === "flashcards"
      ? [
          ...(replace ? [db.flashcard.deleteMany({ where: { noteId, source: "AI" } })] : []),
          db.flashcard.createMany({ data: out.flashcards.map((f) => ({ chapterId: ctx.id, noteId, front: f.front, back: f.back })) }),
        ]
      : [
          ...(replace ? [db.question.deleteMany({ where: { noteId, source: "AI" } })] : []),
          db.question.createMany({ data: out.questions.map((q) => ({ chapterId: ctx.id, noteId, question: q.question, answer: q.answer, keyPoints: JSON.stringify(q.keyPoints) })) }),
        ]);
    done();
    return { made };
  });
}

/** Publishes every draft of one kind (flashcards or written questions) in a chapter to students. */
export async function approveDrafts(chapterId: string, kind: "flashcards" | "questions") {
  return run(async () => {
    const userId = await requireUserId();
    const ctx = await chapterContext(chapterId);
    await requirePower(userId, ctx.classroomId, "study");
    const r = materialKind.parse(kind) === "flashcards"
      ? await db.flashcard.updateMany({ where: { chapterId, status: "DRAFT" }, data: { status: "APPROVED" } })
      : await db.question.updateMany({ where: { chapterId, status: "DRAFT" }, data: { status: "APPROVED" } });
    done();
    return { approved: r.count };
  });
}

const kindSchema = z.enum(["flashcard", "question"]);

async function itemChapter(kind: "flashcard" | "question", id: string) {
  const item = kind === "flashcard"
    ? await db.flashcard.findUnique({ where: { id }, select: { chapterId: true } })
    : await db.question.findUnique({ where: { id }, select: { chapterId: true } });
  if (!item) throw new UserError("That item no longer exists.");
  return chapterContext(item.chapterId);
}

export async function deleteStudyItem(kind: string, id: string) {
  return run(async () => {
    const userId = await requireUserId();
    const k = kindSchema.parse(kind);
    await requirePower(userId, (await itemChapter(k, id)).classroomId, "study");
    if (k === "flashcard") await db.flashcard.delete({ where: { id } });
    else await db.question.delete({ where: { id } });
    done();
  });
}

export async function approveStudyItem(kind: string, id: string) {
  return run(async () => {
    const userId = await requireUserId();
    const k = kindSchema.parse(kind);
    await requirePower(userId, (await itemChapter(k, id)).classroomId, "study");
    if (k === "flashcard") await db.flashcard.update({ where: { id }, data: { status: "APPROVED" } });
    else await db.question.update({ where: { id }, data: { status: "APPROVED" } });
    done();
  });
}

/** The note must be an approved note of this chapter. */
async function checkNote(chapterId: string, noteId: string | null) {
  if (!noteId) return null;
  const n = await db.note.findFirst({ where: { id: noteId, chapterId, status: "APPROVED" }, select: { id: true } });
  if (!n) throw new UserError("Choose a note from this chapter.");
  return n.id;
}

/** Add (id = null) or edit a flashcard by hand. A teacher's save counts as checked, so it is approved. */
export async function saveFlashcard(chapterId: string, id: string | null, noteId: string | null, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const ctx = await chapterContext(chapterId);
    await requirePower(userId, ctx.classroomId, "study");
    const d = flashcardSchema.parse(input);
    const note = await checkNote(chapterId, noteId);
    if (id) {
      if ((await itemChapter("flashcard", id)).id !== chapterId) throw new UserError("That flashcard isn't in this chapter.");
      await db.flashcard.update({ where: { id }, data: { front: d.front, back: d.back, noteId: note, status: "APPROVED", source: "TEACHER" } });
    } else {
      await db.flashcard.create({ data: { chapterId, noteId: note, front: d.front, back: d.back, status: "APPROVED", source: "TEACHER" } });
    }
    done();
  });
}

export async function saveQuestion(chapterId: string, id: string | null, noteId: string | null, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const ctx = await chapterContext(chapterId);
    await requirePower(userId, ctx.classroomId, "study");
    const d = questionSchema.parse(input);
    const note = await checkNote(chapterId, noteId);
    const data = { question: d.question, answer: d.answer, keyPoints: JSON.stringify(d.keyPoints), noteId: note, status: "APPROVED", source: "TEACHER" };
    if (id) {
      if ((await itemChapter("question", id)).id !== chapterId) throw new UserError("That question isn't in this chapter.");
      await db.question.update({ where: { id }, data });
    } else {
      await db.question.create({ data: { chapterId, ...data } });
    }
    done();
  });
}

/* ------------------------------------------------------------------ quizzes (written answers, marked by AI) */

const parseJson = <T,>(s: string): T => JSON.parse(s) as T;

/** Safety caps for marking: per student, and across the whole app per day. */
const GRADE_PER_STUDENT_PER_HOUR = 20;
const DAILY_GRADE_LIMIT = Number(process.env.AI_DAILY_GRADE_LIMIT || 2000);

/**
 * A student's written answers are sent to the AI to be marked, so (like uploading notes) it needs the
 * teacher to have confirmed the parent/guardian consent form. Teachers (and supervisors) can always try quizzes.
 */
function requireMarkingConsent(access: { role: string; membership: { consentVerifiedAt: Date | null } | null }) {
  if (access.role !== "STUDENT") return;
  if (!access.membership?.consentVerifiedAt)
    throw new UserError("Your teacher needs to confirm your parent/guardian consent form before the AI can check your written answers. Ask your teacher.");
}

/**
 * "I've studied these notes": builds a quiz from the APPROVED questions on exactly those notes.
 * The server keeps the question set; the browser never receives the model answers.
 */
export async function startQuiz(chapterId: string, noteIds: string[]) {
  return run(async () => {
    const userId = await requireUserId();
    const ctx = await chapterContext(chapterId);
    const access = await requireMember(userId, ctx.classroomId);
    requireMarkingConsent(access);
    if (!aiEnabled()) throw new UserError("AI is off, so written answers can't be checked right now. You can still use the flashcards.");
    const ids = z.array(z.string().min(1)).min(1, "Tick the notes you have studied.").max(60).parse(noteIds);
    const studied = [...new Set(ids)];
    const notes = await db.note.count({ where: { id: { in: studied }, chapterId, status: "APPROVED" } });
    if (notes !== studied.length) throw new UserError("Choose notes from this chapter.");

    const pool = await db.question.findMany({ where: { chapterId, status: "APPROVED", noteId: { in: studied } }, select: { id: true, noteId: true } });
    if (pool.length < MIN_QUIZ_QUESTIONS) throw new UserError("There aren't enough questions for those notes yet. Ask your teacher, or tick more notes.");

    const past = await db.quizAttempt.findMany({ where: { userId, chapterId, submittedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select: { items: true } });
    const seen = new Set(past.flatMap((a) => parseJson<string[]>(a.items)));
    const picked = pickQuestions(pool, seen, quizSize(studied.length));

    await db.quizAttempt.deleteMany({ where: { userId, chapterId, submittedAt: null } }); // an abandoned quiz
    const attempt = await db.quizAttempt.create({ data: { userId, chapterId, noteIds: JSON.stringify(studied), items: JSON.stringify(picked), total: picked.length } });

    const rows = new Map((await db.question.findMany({ where: { id: { in: picked } }, select: { id: true, question: true } })).map((q) => [q.id, q]));
    const questions: QuizQuestionView[] = picked.flatMap((id) => (rows.has(id) ? [{ id, question: rows.get(id)!.question }] : []));
    return { attemptId: attempt.id, questions };
  });
}

/**
 * Marks the written answers. `answers[i]` is the student's text for question i (blank = skipped, never sent to the AI).
 * If the AI is unreachable the quiz stays open, so the student can press Submit again without losing anything.
 */
/**
 * Marks a written quiz. `confidence` is how sure the student was of each answer (asked before marking); it is
 * saved with the attempt for their Mistake Map and is never sent to the AI.
 */
export async function submitQuiz(attemptId: string, answers: string[], confidence?: (Confidence | null)[]) {
  return run(async (): Promise<QuizResult> => {
    const userId = await requireUserId();
    const attempt = await db.quizAttempt.findUnique({ where: { id: attemptId }, include: { chapter: { select: { subject: { select: { classroomId: true } } } } } });
    // Someone else's attempt looks the same as a missing one.
    if (!attempt || attempt.userId !== userId) throw new UserError("Quiz not found.");
    const classroomId = attempt.chapter.subject.classroomId;
    const access = await requireMember(userId, classroomId);
    requireMarkingConsent(access);
    if (attempt.submittedAt) throw new UserError("You've already submitted this quiz.");

    const ids = parseJson<string[]>(attempt.items);
    const given = z.array(z.string().max(MAX_ANSWER_CHARS * 2)).length(ids.length).parse(answers).map((a) => a.trim().slice(0, MAX_ANSWER_CHARS));
    const questions = await db.question.findMany({ where: { id: { in: ids } } });
    const byId = new Map(questions.map((q) => [q.id, q]));
    // A question the teacher deleted mid-quiz is left out rather than marked wrong.
    const sure = z.array(z.enum(CONFIDENCES).nullable()).length(ids.length).optional().parse(confidence ?? undefined);
    const kept = ids.map((id, i) => ({ id, answer: given[i], confidence: sure?.[i] ?? null })).filter((x) => byId.has(x.id));
    if (kept.length === 0) throw new UserError("This quiz is no longer available. Start a new one.");

    // Blank answers are skipped without asking the AI; the rest are marked together in one request.
    const toMark = kept.filter((x) => !isBlank(x.answer));
    let marks: Grade[] = [];
    if (toMark.length > 0) {
      if (!aiEnabled()) throw new UserError("AI is off, so written answers can't be checked right now.");
      if (tooMany(`grade:${userId}`, GRADE_PER_STUDENT_PER_HOUR, 3_600_000)) throw new UserError("You've submitted a lot of quizzes in the last hour. Take a break and try again later.");
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if ((await db.aiUsage.count({ where: { kind: "GRADE", createdAt: { gte: start } } })) >= DAILY_GRADE_LIMIT) throw new UserError("The daily AI limit has been reached. Your answers are still here. Try again tomorrow.");
      record(`grade:${userId}`);
      const usage = (inputTokens: number, outputTokens: number) => db.aiUsage.create({ data: { classroomId, model: "grade", kind: "GRADE", inputTokens, outputTokens } });
      try {
        const out = await gradeAnswers(toMark.map((x) => {
          const q = byId.get(x.id)!;
          return { question: q.question, answer: q.answer, keyPoints: parseJson<string[]>(q.keyPoints), studentAnswer: x.answer };
        }));
        marks = out.grades;
        await usage(out.inputTokens, out.outputTokens);
        // Web searches are billed per call (about $0.01 each), so each one is counted (no content stored).
        if (out.searches) await db.aiUsage.createMany({ data: Array.from({ length: out.searches }, () => ({ classroomId, model: "web_search", kind: "SEARCH", inputTokens: 0, outputTokens: 0 })) });
      } catch (e) {
        const spent = e as { inputTokens?: number; outputTokens?: number };
        if (spent.inputTokens || spent.outputTokens) await usage(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
        if (e instanceof StudyOutputError) throw new UserError("The AI couldn't mark your answers this time. Your answers are still here. Press Submit again.");
        if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Your answers are still here. Try again in a moment.`);
        throw e;
      }
    }
    let m = 0;
    const grades: Grade[] = kept.map((x) => (isBlank(x.answer) ? { verdict: "SKIPPED", feedback: "You left this one blank." } : marks[m++]));
    const score = pointsOf(grades);

    const claimed = await db.quizAttempt.updateMany({
      where: { id: attemptId, submittedAt: null },
      data: { items: JSON.stringify(kept.map((x) => x.id)), answers: JSON.stringify(kept.map((x) => x.answer)), grades: JSON.stringify(grades), confidence: JSON.stringify(kept.map((x) => x.confidence)), score, total: kept.length, submittedAt: new Date() },
    });
    if (claimed.count !== 1) throw new UserError("You've already submitted this quiz.");
    await awardQuietly(userId, { xp: Math.round(score * XP.quizPoint), once: `quiz:${attemptId}` });

    const keptIds = kept.map((x) => x.id);
    const noteTitles = new Map((await db.note.findMany({ where: { id: { in: questions.flatMap((q) => (q.noteId ? [q.noteId] : [])) } }, select: { id: true, title: true } })).map((n) => [n.id, n.title]));
    const breakdown = noteBreakdown(keptIds, grades, new Map(questions.map((q) => [q.id, q.noteId])));
    done();
    return {
      points: score, total: kept.length, percent: Math.round((score / kept.length) * 100),
      questions: kept.map((x, i) => ({ question: byId.get(x.id)!.question, answer: x.answer, verdict: grades[i].verdict, feedback: grades[i].feedback, modelAnswer: byId.get(x.id)!.answer, confidence: x.confidence })),
      notes: [...breakdown].filter(([id]) => id && noteTitles.has(id)).map(([noteId, r]) => ({ noteId, title: noteTitles.get(noteId)!, points: r.points, total: r.total, weak: r.points / r.total < WEAK_BELOW })),
    };
  });
}
