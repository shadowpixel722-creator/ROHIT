import { z } from "zod";
import { GRADES, SUBJECT_COLOR_KEYS } from "./constants";
import { addDays, dateToKey, keyToDate, todayKey } from "./dates";

const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer`);

const base = {
  name: trimmed(80).min(1, "Please enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
};

export const registerSchema = z.discriminatedUnion("role", [
  z.object({ ...base, role: z.literal("TEACHER"), school: trimmed(120).optional().transform((v) => v || null) }),
  z.object({
    ...base,
    role: z.literal("STUDENT"),
    guardianName: trimmed(80).min(1, "Enter your parent or guardian's name"),
    consent: z.literal(true, { error: "Your parent or guardian must agree before you can create an account" }),
  }),
]);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const classroomSchema = z.object({
  name: trimmed(80).min(1, "Give your class a name"),
  grade: z.enum(GRADES as [string, ...string[]]).nullable().optional().transform((v) => v ?? null),
});

export const subjectSchema = z.object({
  name: trimmed(60).min(1, "Subject name is required"),
  color: z.enum(SUBJECT_COLOR_KEYS as [string, ...string[]]).optional(),
});

export const chapterSchema = z.object({ name: trimmed(160).min(1, "Chapter name is required") });

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

export const noteSchema = z.object({
  title: trimmed(120).min(1, "Give the note a title, e.g. “Coal and Petroleum: class notes”"),
  text: z.string().trim().max(20_000, "Typed notes can be up to 20,000 characters").optional().transform((v) => v || null),
  subjectId: z.string().min(1, "Choose a subject"),
  chapterId: z.string().optional().transform((v) => v || null),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date of these notes")
    .refine((d) => d >= "2000-01-01" && d <= new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10), "The date can't be in the future")
    .transform((d) => new Date(`${d}T00:00:00.000Z`)),
});

export const commentSchema = z.object({ body: trimmed(1000).min(1, "Write something first") });
export const rejectSchema = z.object({ reason: trimmed(300).min(3, "Tell the student why, so they can fix it") });

export const ASSESSMENT_KINDS = ["TEST", "ASSIGNMENT", "EXAM"] as const;

/** True only for a real calendar day like 2026-12-03 (not 2026-02-31, and never throws on junk). */
const realDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(keyToDate(d).getTime()) && dateToKey(keyToDate(d)) === d;

/** A teacher sets a test, assignment or exam on a date, covering chapters of one subject. */
export const assessmentSchema = z.object({
  kind: z.enum(ASSESSMENT_KINDS, { error: "Choose test, assignment or exam" }),
  title: trimmed(100).min(1, "Give it a title, e.g. “Unit 2 test”"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date").refine(realDay, "That date doesn't exist")
    .refine((d) => d <= addDays(todayKey(), 800), "Choose a date within the next two years"),
  subjectId: z.string().min(1, "Choose a subject"),
  chapterIds: z.array(z.string().min(1)).min(1, "Choose at least one chapter it covers").max(80),
  /** Optional exam pattern it follows ("" = none) */
  patternId: z.string().max(40).nullish().transform((v) => v || null),
});
