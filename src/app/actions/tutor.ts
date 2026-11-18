"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { z } from "zod";
import { requireMember, requireTeacher } from "@/lib/access";
import { askTutor, teachBack } from "@/lib/ai-study";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { lessonText } from "@/lib/explain-schema";
import { cleanPhoto, MAX_PHOTO_BYTES } from "@/lib/photo";
import { awardQuietly } from "@/lib/game-server";
import { record, tooMany } from "@/lib/rate-limit";
import { getToday } from "@/lib/server";
import { StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";
import { MAX_DOUBT, MAX_EXPLANATION, PHOTOS_PER_HOUR, pickNotes, TUTOR_PER_HOUR } from "@/lib/tutor";

const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);

/**
 * Who may use the AI tutor: teachers, and students whose guardian consent form the teacher has confirmed,
 * in a class where the teacher hasn't switched it off. Also the hourly and daily limits.
 */
async function guard(userId: string, classroomId: string, photo: boolean) {
  const access = await requireMember(userId, classroomId);
  if (!access.classroom.aiTutor) throw new UserError("Your teacher has switched the AI tutor off for this class.");
  if (access.role === "STUDENT" && !access.membership?.consentVerifiedAt)
    throw new UserError("Your teacher needs to confirm your parent/guardian consent form before you can use the AI tutor. Ask your teacher.");
  if (!aiEnabled()) throw new UserError("AI is off right now, so the tutor can't answer.");
  if (tooMany(`tutor:${userId}`, TUTOR_PER_HOUR, 3_600_000)) throw new UserError("You've asked a lot in the last hour. Take a short break and try again later.");
  if (photo && tooMany(`tutor-photo:${userId}`, PHOTOS_PER_HOUR, 3_600_000)) throw new UserError("You've sent a lot of photos in the last hour. Try typing the question instead.");
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) throw new UserError("The daily AI limit has been reached. Try again tomorrow.");
  record(`tutor:${userId}`); if (photo) record(`tutor-photo:${userId}`);
  return access;
}

/** The class's approved notes (typed text and the text read from their pages), optionally one chapter's. */
async function classNotes(classroomId: string, chapterId?: string | null) {
  const notes = await db.note.findMany({
    where: { classroomId, status: "APPROVED", ...(chapterId ? { chapterId } : {}) },
    orderBy: { createdAt: "desc" }, take: 200,
    select: { id: true, title: true, text: true, chapter: { select: { name: true } }, subject: { select: { name: true } }, images: { orderBy: { position: "asc" }, select: { transcript: true } } },
  });
  return notes.map((n) => ({ id: n.id, title: n.title, chapter: n.chapter?.name ?? n.subject.name, subject: n.subject.name, text: lessonText(n) })).filter((n) => n.text.trim());
}

const usage = (classroomId: string, i: number, o: number) => db.aiUsage.create({ data: { classroomId, model: "tutor", kind: "STUDY", inputTokens: i, outputTokens: o } });
async function aiCall<T extends { inputTokens: number; outputTokens: number }>(classroomId: string, fn: () => Promise<T>) {
  try {
    const out = await fn();
    await usage(classroomId, out.inputTokens, out.outputTokens);
    return out;
  } catch (e) {
    const spent = e as { inputTokens?: number; outputTokens?: number };
    if (spent.inputTokens || spent.outputTokens) await usage(classroomId, spent.inputTokens ?? 0, spent.outputTokens ?? 0);
    if (e instanceof StudyOutputError) throw new UserError("The tutor's answer didn't come through. Please ask again.");
    if (e instanceof OpenAI.APIError) throw new UserError(`The AI service had a problem (${e.status ?? "network"}). Please try again in a moment.`);
    throw e;
  }
}

/**
 * Ask a doubt (and optionally attach a photo of the question). Answered from the class's approved notes.
 * Nothing is stored: not the question, the photo or the answer.
 */
export async function askDoubt(classroomId: string, input: { question: string; photo?: string | null; chapterId?: string | null }) {
  return run(async () => {
    const userId = await requireUserId();
    const i = z.object({ question: z.string().max(MAX_DOUBT * 2), photo: z.string().max(MAX_PHOTO_BYTES * 1.4).nullish(), chapterId: z.string().nullish() }).parse(input);
    const question = i.question.trim().slice(0, MAX_DOUBT);
    if (!question && !i.photo) throw new UserError("Type your doubt or attach a photo of it.");
    const access = await guard(userId, classroomId, !!i.photo);
    const image = i.photo ? await cleanPhoto(i.photo) : null;
    const all = await classNotes(classroomId, i.chapterId);
    const notes = pickNotes(question || "this question", all);
    const subject = notes.length ? all.find((n) => n.title === notes[0].title)?.subject ?? null : null;
    const out = await aiCall(classroomId, () => askTutor({ grade: access.classroom.grade, subject, question, notes, image }));
    await awardQuietly(userId, { xp: 0 }); // asking counts towards the streak
    return { ...out.reply, notes: notes.map((n) => ({ title: n.title, chapter: n.chapter })) };
  });
}

/** Teach Knowa: you explain a topic; the tutor plays a curious younger classmate and tells you what clicked and what's missing. */
export async function teachKnowa(classroomId: string, input: { topic: string; explanation: string; history?: string[] }) {
  return run(async () => {
    const userId = await requireUserId();
    const i = z.object({ topic: z.string().trim().min(2, "Say which topic you're teaching.").max(90), explanation: z.string().trim().min(8, "Explain a little more first.").max(MAX_EXPLANATION), history: z.array(z.string().max(700)).max(8).default([]) }).parse(input);
    const access = await guard(userId, classroomId, false);
    const notes = pickNotes(`${i.topic} ${i.explanation}`, await classNotes(classroomId), 2);
    const out = await aiCall(classroomId, () => teachBack({ grade: access.classroom.grade, topic: i.topic, explanation: i.explanation, history: i.history, notes }));
    await awardQuietly(userId, { xp: out.reply.stars * 2, once: `teach:${i.topic.toLowerCase()}:${await getToday()}` });
    return out.reply;
  });
}

/** Teacher: switch the AI tutor on or off for the class. */
export async function setAiTutor(classroomId: string, on: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, classroomId);
    await db.classroom.update({ where: { id: classroomId }, data: { aiTutor: z.boolean().parse(on) } });
    revalidatePath("/", "layout");
    return { on };
  });
}
