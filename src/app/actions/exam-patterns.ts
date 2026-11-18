"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";
import { requireTeacher } from "@/lib/access";
import { readPattern } from "@/lib/ai-study";
import { MAX_ATTACHMENTS } from "@/lib/attachment-check";
import { attachmentsFrom, saveAttachments } from "@/lib/attachment-save";
import { removeUploads } from "@/lib/files";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { patternSchema, statedTotal, type Pattern } from "@/lib/exam-schema";
import { StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";

const done = () => revalidatePath("/", "layout");
const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);
const MAX_PATTERNS = 30;

const lessonsSchema = z.array(z.string().min(1)).min(1, "Choose at least one lesson for this exam").max(60);

/**
 * Saves an exam pattern with the lessons it covers. Only lessons (chapters) of this class that have
 * approved notes can be chosen.
 */
export async function savePattern(classroomId: string, id: string | null, input: unknown, chapterIds: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, classroomId);
    const p = patternSchema.parse(input);
    const wanted = [...new Set(lessonsSchema.parse(chapterIds))];
    const ok = await db.chapter.findMany({
      where: { id: { in: wanted }, subject: { classroomId }, notes: { some: { status: "APPROVED" } } },
      select: { id: true },
    });
    if (ok.length !== wanted.length) throw new UserError("Choose lessons from this class that have approved notes.");
    const data = { name: p.name, durationMinutes: p.durationMinutes, instructions: p.instructions, sections: JSON.stringify(p.sections) };
    const lessons = wanted.map((chapterId) => ({ chapterId }));

    if (id) {
      const existing = await db.examPattern.findFirst({ where: { id, classroomId }, select: { id: true } });
      if (!existing) throw new UserError("That pattern no longer exists.");
      await db.$transaction([
        db.examPatternChapter.deleteMany({ where: { patternId: id } }),
        db.examPattern.update({ where: { id }, data: { ...data, lessons: { create: lessons } } }),
      ]);
    } else {
      if ((await db.examPattern.count({ where: { classroomId } })) >= MAX_PATTERNS) throw new UserError(`A class can keep up to ${MAX_PATTERNS} patterns. Delete one first.`);
      id = (await db.examPattern.create({ data: { classroomId, ...data, lessons: { create: lessons } } })).id;
    }
    done();
    return { id };
  });
}

export async function deletePattern(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    const p = await db.examPattern.findUnique({ where: { id }, select: { classroomId: true } });
    if (!p) throw new UserError("That pattern no longer exists.");
    await requireTeacher(userId, p.classroomId);
    const files = await db.examPatternAttachment.findMany({ where: { patternId: id }, select: { filePath: true } });
    await db.examPattern.delete({ where: { id } });
    await removeUploads(files.map((f) => f.filePath));
    done();
  });
}

/** Reads a pattern the teacher pasted (e.g. from the school's circular) into sections for them to check. */
export async function readPastedPattern(classroomId: string, description: string) {
  return run(async (): Promise<Pattern & { statedMarks: number | null }> => {
    const userId = await requireUserId();
    await requireTeacher(userId, classroomId);
    const text = z.string().trim().min(15, "Describe the pattern: sections, number of questions and marks.").max(4000).parse(description);
    if (!aiEnabled()) throw new UserError("AI is off, so a pasted pattern can't be read right now. Set the sections by hand.");
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");
    const record = (i: number, o: number) => db.aiUsage.create({ data: { classroomId, model: "pattern", kind: "STUDY", inputTokens: i, outputTokens: o } });
    try {
      const out = await readPattern(text);
      await record(out.inputTokens, out.outputTokens);
      // If the description states a total ("80 marks") that the sections don't add up to, the teacher should know.
      return { ...out.pattern, statedMarks: statedTotal(text) };
    } catch (e) {
      const spent = e as { inputTokens?: number; outputTokens?: number };
      if (spent.inputTokens || spent.outputTokens) await record(spent.inputTokens ?? 0, spent.outputTokens ?? 0);
      if (e instanceof StudyOutputError) throw new UserError(e.message);
      if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
      throw e;
    }
  });
}

/* ------------------------------------------------------------------ attachments (teachers add, whole class downloads) */

async function teacherOfPattern(patternId: string) {
  const userId = await requireUserId();
  const p = await db.examPattern.findUnique({ where: { id: patternId }, select: { classroomId: true } });
  if (!p) throw new UserError("That pattern no longer exists.");
  await requireTeacher(userId, p.classroomId);
  return p.classroomId;
}

/** Adds files to a pattern (form field "attachments"). Checked by content; nothing is saved if any file is refused. */
export async function addPatternAttachments(patternId: string, form: FormData) {
  return run(async () => {
    const classroomId = await teacherOfPattern(patternId);
    const files = attachmentsFrom(form);
    if (files.length === 0) throw new UserError("Choose a file to attach.");
    const existing = await db.examPatternAttachment.count({ where: { patternId } });
    if (existing + files.length > MAX_ATTACHMENTS) throw new UserError(`A pattern can have up to ${MAX_ATTACHMENTS} attachments.`);
    const saved = await saveAttachments(classroomId, files);
    try {
      await db.examPatternAttachment.createMany({ data: saved.map((a, i) => ({ ...a, patternId, position: existing + i })) });
    } catch (e) {
      await removeUploads(saved.map((a) => a.filePath));
      throw e;
    }
    done();
  });
}

export async function removePatternAttachment(id: string) {
  return run(async () => {
    const file = await db.examPatternAttachment.findUnique({ where: { id }, select: { patternId: true, filePath: true } });
    if (!file) throw new UserError("That file was already removed.");
    await teacherOfPattern(file.patternId);
    await db.examPatternAttachment.delete({ where: { id } });
    await removeUploads([file.filePath]);
    done();
  });
}
