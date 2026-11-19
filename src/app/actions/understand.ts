"use server";

import { z } from "zod";
import { requireMember } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { studentAiBlock, type ClassAccess } from "@/lib/ai-guard";
import { explainSimply } from "@/lib/ai-study";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText, type Explanation } from "@/lib/explain-schema";
import { LESSON_BY_ID } from "@/lib/knowa/lessons";
import type { Scene } from "@/lib/model3d-schema";
import { record, tooMany } from "@/lib/rate-limit";
import { MAX_NOTES_CHARS, type NoteSnippet } from "@/lib/tutor";
import { excerpt, UNDERSTAND_PER_HOUR, type UnderstandItem } from "@/lib/understand";

/** What "I don't understand" can be pressed on. The server loads the content itself; the browser only says which one. */
export type UnderstandTarget =
  | { kind: "mcq"; sessionId: string; position: number }
  | { kind: "question"; attemptId: string; index: number }
  | { kind: "explanation"; noteId: string }
  | { kind: "model"; noteId: string }
  | { kind: "lesson"; lessonId: string; step: number; classroomId?: string | null };

export type UnderstandResult =
  | { source: "ai"; explanation: string; words: { word: string; meaning: string }[] }
  /** No AI: what's already saved. `why` says why the AI wasn't used (null when there's simply no AI for this). */
  | { source: "saved"; heading: string; text: string; why: string | null };

const Target = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("mcq"), sessionId: z.string().min(1).max(64), position: z.number().int().min(0).max(200) }),
  z.object({ kind: z.literal("question"), attemptId: z.string().min(1).max(64), index: z.number().int().min(0).max(200) }),
  z.object({ kind: z.literal("explanation"), noteId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("model"), noteId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("lesson"), lessonId: z.string().min(1).max(64), step: z.number().int().min(0).max(100), classroomId: z.string().max(64).nullish() }),
]);

const parse = <T,>(s: string | null | undefined, fallback: T): T => { try { return (JSON.parse(s ?? "") as T) ?? fallback; } catch { return fallback; } };
const notFound = () => new UserError("That couldn't be found. It may have been removed.");
const noteSelect = { id: true, title: true, text: true, status: true, classroomId: true, subject: { select: { name: true } }, chapter: { select: { name: true } }, images: { orderBy: { position: "asc" as const }, select: { transcript: true } } } as const;
type NoteRow = { title: string; text: string | null; status: string; subject: { name: string }; chapter: { name: string } | null; images: { transcript: string | null }[] };
const snippet = (n: NoteRow): NoteSnippet => ({ title: n.title, chapter: n.chapter?.name ?? n.subject.name, text: excerpt(lessonText(n), MAX_NOTES_CHARS / 2) });
const letter = (i: number) => String.fromCharCode(65 + i);

/** A class note a member may read: approved, or any note for the class's teacher. */
async function readableNote(userId: string, noteId: string) {
  const note = await db.note.findUnique({ where: { id: noteId }, select: noteSelect });
  if (!note) throw notFound();
  const access = await requireMember(userId, note.classroomId);
  if (note.status !== "APPROVED" && access.role !== "TEACHER") throw notFound();
  return { note, access };
}

/** Loads the item, who may see it, its source note, and the no-AI fallback. Never trusts the browser's copy of anything. */
async function load(userId: string, t: z.infer<typeof Target>): Promise<{ access: ClassAccess | null; subject: string | null; item: UnderstandItem; notes: NoteSnippet[]; saved: { heading: string; text: string } }> {
  if (t.kind === "mcq") {
    const session = await db.mcqSession.findUnique({ where: { id: t.sessionId }, select: { userId: true, kind: true, items: true } });
    if (!session || session.userId !== userId || session.kind !== "practice") throw notFound();
    const it = parse<{ id: string; perm: number[] }[]>(session.items, [])[t.position];
    if (!it) throw notFound();
    const q = await db.mcqQuestion.findUnique({ where: { id: it.id }, select: { stem: true, choices: true, answerIndex: true, explanation: true, note: { select: noteSelect }, chapter: { select: { name: true, subject: { select: { name: true, classroomId: true } } } } } });
    if (!q) throw notFound();
    const access = await requireMember(userId, q.chapter.subject.classroomId);
    const answered = !!(await db.mcqAnswer.findUnique({ where: { sessionId_position: { sessionId: t.sessionId, position: t.position } }, select: { id: true } }));
    const choices = parse<string[]>(q.choices, []);
    const shown = it.perm.map((orig) => choices[orig] ?? "");
    const right = it.perm.indexOf(q.answerIndex);
    const answer = `${letter(right)}) ${shown[right]}${q.explanation ? `. ${q.explanation}` : ""}`;
    const note = q.note?.status === "APPROVED" ? q.note : null;
    return {
      access, subject: q.chapter.subject.name, notes: note ? [snippet(note)] : [],
      item: { kind: "mcq", title: q.chapter.name, content: `${q.stem}\n${shown.map((c, i) => `${letter(i)}) ${c}`).join("\n")}`, answered, ...(answered ? { answer } : {}) },
      saved: answered
        ? { heading: "Why the right answer is right", text: `The right answer is ${answer}${note ? `\n\nFrom your class notes (${note.title}): ${excerpt(lessonText(note), 400)}` : ""}` }
        : note ? { heading: `From your class notes: ${note.title}`, text: excerpt(lessonText(note)) }
        : { heading: "Try this", text: "Read the question slowly and find the key word it asks about. Look that word up in your notes for this chapter, then read each option and cross out the ones you're sure are wrong." },
    };
  }
  if (t.kind === "question") {
    const attempt = await db.quizAttempt.findUnique({ where: { id: t.attemptId }, select: { userId: true, items: true, submittedAt: true } });
    if (!attempt || attempt.userId !== userId) throw notFound();
    const id = parse<string[]>(attempt.items, [])[t.index];
    if (!id) throw notFound();
    const q = await db.question.findUnique({ where: { id }, select: { question: true, answer: true, keyPoints: true, note: { select: noteSelect }, chapter: { select: { name: true, subject: { select: { name: true, classroomId: true } } } } } });
    if (!q) throw notFound();
    const access = await requireMember(userId, q.chapter.subject.classroomId);
    const answered = !!attempt.submittedAt;
    const points = parse<string[]>(q.keyPoints, []);
    const answer = `${q.answer}${points.length ? `\nA full answer includes: ${points.join("; ")}` : ""}`;
    const note = q.note?.status === "APPROVED" ? q.note : null;
    return {
      access, subject: q.chapter.subject.name, notes: note ? [snippet(note)] : [],
      item: { kind: "question", title: q.chapter.name, content: q.question, answered, ...(answered ? { answer } : {}) },
      saved: answered
        ? { heading: "The model answer, and what a full answer needs", text: answer }
        : note ? { heading: `From your class notes: ${note.title}`, text: excerpt(lessonText(note)) }
        : { heading: "Try this", text: "Find the question word (what, why, how, explain, compare) and the topic it asks about. Write one sentence about the topic from your notes, then add the reason or an example." },
    };
  }
  if (t.kind === "explanation" || t.kind === "model") {
    const { note, access } = await readableNote(userId, t.noteId);
    const base = { access, subject: note.subject.name, notes: [snippet(note)] };
    if (t.kind === "explanation") {
      const row = await db.noteExplanation.findUnique({ where: { noteId: note.id }, select: { content: true } });
      const ex = parse<Explanation | null>(row?.content, null);
      if (!ex) throw new UserError("This lesson hasn't been explained yet.");
      const content = [ex.summary, ...ex.keyPoints.map((k) => `• ${k}`), ...ex.sections.map((s) => `${s.heading}: ${s.explanation}`)].join("\n");
      return { ...base, item: { kind: "explanation", title: note.title, content, answered: false }, saved: { heading: `Your class note it explains: ${note.title}`, text: excerpt(lessonText(note), 900) } };
    }
    const row = await db.noteModel3D.findUnique({ where: { noteId: note.id }, select: { content: true } });
    const scene = parse<Scene | null>(row?.content, null);
    if (!scene) throw new UserError("This lesson has no 3D model yet.");
    const parts = scene.objects.filter((o) => o.label).map((o) => `• ${o.label}${o.info ? `: ${o.info}` : ""}`);
    const tour = scene.steps.map((s, i) => `${i + 1}. ${s.caption}`);
    const text = [scene.intro, parts.length ? `The parts:\n${parts.join("\n")}` : "", tour.length ? `The tour:\n${tour.join("\n")}` : ""].filter(Boolean).join("\n\n");
    return { ...base, item: { kind: "model", title: scene.title || note.title, content: text, answered: false }, saved: { heading: `What the model shows: ${scene.title || note.title}`, text } };
  }
  // A step of a narrated 3D lesson (fixed content). Outside a class there's no AI, so it's the saved words only.
  const lesson = LESSON_BY_ID[t.lessonId];
  if (!lesson) throw notFound();
  const access = t.classroomId ? await requireMember(userId, t.classroomId) : null;
  const i = Math.min(t.step, lesson.steps.length - 1);
  const stepText = (k: number) => { const s = lesson.steps[k]; return [s.note?.title, s.say, ...(s.note?.lines ?? []), s.note?.formula].filter(Boolean).join("\n"); };
  const text = [i > 0 ? `Just before: ${lesson.steps[i - 1].say}` : "", `This step: ${stepText(i)}`].filter(Boolean).join("\n\n");
  return {
    access, subject: lesson.subject, notes: [],
    item: { kind: "lesson", title: `${lesson.title}, step ${i + 1}`, content: text, answered: false },
    saved: { heading: `Step ${i + 1}, written out`, text },
  };
}

/**
 * "I don't understand": a simpler explanation, by AI when this student may use it, otherwise what's saved.
 * Nothing is stored. The answer to a question not yet answered is never loaded into the AI request.
 */
export async function explainThis(input: UnderstandTarget) {
  return run(async (): Promise<UnderstandResult> => {
    const userId = await requireUserId();
    const t = Target.parse(input);
    const { access, subject, item, notes, saved } = await load(userId, t);
    const fallback = (why: string | null): UnderstandResult => ({ source: "saved", ...saved, why });
    if (!access) return fallback(null);
    const blocked = await studentAiBlock(access);
    if (blocked) return fallback(blocked);
    if (tooMany(`understand:${userId}`, UNDERSTAND_PER_HOUR, 3_600_000)) return fallback("You've asked for a lot of explanations in the last hour, so here's the saved one.");
    record(`understand:${userId}`);
    try {
      const out = await explainSimply({ grade: access.classroom.grade, subject, item, notes });
      await db.aiUsage.create({ data: { classroomId: access.classroom.id, model: "understand", kind: "STUDY", inputTokens: out.inputTokens, outputTokens: out.outputTokens } });
      return { source: "ai", ...out.reply };
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await db.aiUsage.create({ data: { classroomId: access.classroom.id, model: "understand", kind: "STUDY", inputTokens: spent.inputTokens ?? 0, outputTokens: spent.outputTokens ?? 0 } });
      return fallback("The AI didn't answer just now, so here's what's saved.");
    }
  });
}
