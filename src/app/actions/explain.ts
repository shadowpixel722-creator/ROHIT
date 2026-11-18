"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { requireMember } from "@/lib/access";
import { explainLesson } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText, textHash } from "@/lib/explain-schema";
import { record, tooMany } from "@/lib/rate-limit";
import { MIN_NOTE_CHARS, StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);
/** Explanations being written right now, so two people opening the same lesson don't both pay for one. */
const inFlight = new Set<string>();

/**
 * Makes (or remakes, if the note's text changed) the Explain tab's explanation of one approved note.
 * Anyone in the class can trigger it by opening the lesson; teachers can force a fresh one.
 * Only the approved note's text is sent to the AI.
 */
export async function explainNote(noteId: string, force = false) {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true, title: true, status: true, text: true, classroomId: true,
        images: { orderBy: { position: "asc" }, select: { transcript: true } },
        subject: { select: { name: true } }, chapter: { select: { name: true } }, classroom: { select: { grade: true } },
        explanation: { select: { sourceHash: true } },
      },
    });
    if (!note) throw new UserError("Lesson not found.");
    const access = await requireMember(userId, note.classroomId);
    if (note.status !== "APPROVED") throw new UserError("Only approved notes can be explained.");
    if (force && access.role !== "TEACHER") throw new UserError("Only the teacher can remake an explanation.");

    const text = lessonText(note);
    const hash = textHash(text);
    if (!force && note.explanation?.sourceHash === hash) return { made: false };
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("This lesson doesn't have enough text yet. If its page photos are still being converted, try again in a minute.");
    if (!aiEnabled()) throw new UserError("AI is off, so lessons can't be explained right now.");
    if (inFlight.has(noteId)) throw new UserError("An explanation for this lesson is being written. It will appear in a moment.");
    if (tooMany(`explain:${userId}`, 30, 3_600_000)) throw new UserError("You've opened a lot of new lessons in the last hour. Try again later.");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");

    inFlight.add(noteId);
    record(`explain:${userId}`);
    try {
      const out = await explainLesson({ grade: note.classroom.grade, subject: note.subject.name, chapter: note.chapter?.name ?? "General", title: note.title, text });
      await db.aiUsage.create({ data: { classroomId: note.classroomId, model: "explain", kind: "STUDY", inputTokens: out.inputTokens, outputTokens: out.outputTokens } });
      const content = JSON.stringify(out.explanation);
      await db.noteExplanation.upsert({ where: { noteId }, create: { noteId, content, sourceHash: hash }, update: { content, sourceHash: hash, createdAt: new Date() } });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await db.aiUsage.create({ data: { classroomId: note.classroomId, model: "explain", kind: "STUDY", inputTokens: spent.inputTokens ?? 0, outputTokens: spent.outputTokens ?? 0 } });
      if (e instanceof StudyOutputError) throw new UserError(`${e.message} Please try again.`);
      if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
      throw e;
    } finally {
      inFlight.delete(noteId);
    }
    revalidatePath(`/classes/${note.classroomId}/explain`, "layout");
    return { made: true };
  });
}
