"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { requireMember } from "@/lib/access";
import { buildLessonModel } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText, textHash } from "@/lib/explain-schema";
import { LIBRARY, matchLibrary } from "@/lib/model3d-library";
import { record, tooMany } from "@/lib/rate-limit";
import { MIN_NOTE_CHARS, StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);
/** Models being built right now, so two people clicking the same lesson don't both pay for one. */
const inFlight = new Set<string>();

/**
 * "Show in 3D" on an approved lesson in the Explain tab. Made once and saved:
 * - "auto" (anyone in the class): a hand-built library model if the lesson clearly matches one (free), otherwise built by AI.
 * - "ai" (teacher only): build a new one with AI, even if a library model matches.
 * - "library" (teacher only): switch back to the matching hand-built model.
 * Only the approved note's text (and its title, contact details removed) is sent to the AI.
 */
export async function makeLessonModel(noteId: string, mode: "auto" | "ai" | "library" = "auto") {
  return run(async () => {
    const userId = await requireUserId();
    const note = await db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true, title: true, status: true, text: true, classroomId: true,
        images: { orderBy: { position: "asc" }, select: { transcript: true } },
        subject: { select: { name: true } }, chapter: { select: { name: true } }, classroom: { select: { grade: true } },
        model3d: { select: { sourceHash: true } },
      },
    });
    if (!note) throw new UserError("Lesson not found.");
    const access = await requireMember(userId, note.classroomId);
    if (note.status !== "APPROVED") throw new UserError("Only approved notes can be shown in 3D.");
    if (mode !== "auto" && access.role !== "TEACHER") throw new UserError("Only the teacher can remake a 3D model.");

    const text = lessonText(note);
    const hash = textHash(text);
    if (mode === "auto" && note.model3d?.sourceHash === hash) return { made: false };

    const lesson = { grade: note.classroom.grade, subject: note.subject.name, chapter: note.chapter?.name ?? "General", title: note.title, text };
    const libraryId = mode === "ai" ? null : matchLibrary(lesson);
    if (mode === "library" && !libraryId) throw new UserError("None of the hand-built models fits this lesson.");
    if (libraryId) {
      await db.noteModel3D.upsert({
        where: { noteId },
        create: { noteId, content: JSON.stringify(LIBRARY[libraryId]), source: "library", libraryId, sourceHash: hash },
        update: { content: JSON.stringify(LIBRARY[libraryId]), source: "library", libraryId, sourceHash: hash, createdAt: new Date() },
      });
      revalidatePath(`/classes/${note.classroomId}/explain`, "layout");
      return { made: true };
    }

    // A hand-built model only needs the topic; the AI needs enough of the lesson to build from.
    if (text.replace(/\s+/g, " ").length < MIN_NOTE_CHARS) throw new UserError("This lesson doesn't have enough text yet. If its page photos are still being converted, try again in a minute.");
    if (!aiEnabled()) throw new UserError("AI is off, and none of the hand-built models fits this lesson, so it can't be shown in 3D right now.");
    if (inFlight.has(noteId)) throw new UserError("A 3D model of this lesson is being built. It will appear in a moment.");
    if (tooMany(`model3d:${userId}`, 20, 3_600_000)) throw new UserError("You've made a lot of 3D models in the last hour. Try again later.");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");

    inFlight.add(noteId);
    record(`model3d:${userId}`);
    try {
      const out = await buildLessonModel(lesson);
      await db.aiUsage.create({ data: { classroomId: note.classroomId, model: "model3d", kind: "STUDY", inputTokens: out.inputTokens, outputTokens: out.outputTokens } });
      const content = JSON.stringify(out.scene);
      await db.noteModel3D.upsert({
        where: { noteId },
        create: { noteId, content, source: "ai", libraryId: null, sourceHash: hash },
        update: { content, source: "ai", libraryId: null, sourceHash: hash, createdAt: new Date() },
      });
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await db.aiUsage.create({ data: { classroomId: note.classroomId, model: "model3d", kind: "STUDY", inputTokens: spent.inputTokens ?? 0, outputTokens: spent.outputTokens ?? 0 } });
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
