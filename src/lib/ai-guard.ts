import "server-only";
import type { getClassAccess } from "./access";
import { db } from "./db";
import { aiEnabled } from "./transcribe";

const DAILY_STUDY_LIMIT = Number(process.env.AI_DAILY_STUDY_LIMIT || 200);
export type ClassAccess = NonNullable<Awaited<ReturnType<typeof getClassAccess>>>;

/**
 * Why this person can't use the student-facing AI in this class right now, or null if they can. Shared by
 * the AI tutor and "I don't understand": the teacher hasn't switched the tutor off, a student's guardian
 * consent form is confirmed, AI is on, and the app's daily study cap isn't used up.
 */
export async function studentAiBlock(access: ClassAccess): Promise<string | null> {
  if (!access.classroom.aiTutor) return "Your teacher has switched the AI tutor off for this class.";
  if (access.role === "STUDENT" && !access.membership?.consentVerifiedAt)
    return "Your teacher needs to confirm your parent/guardian consent form before you can use the AI tutor. Ask your teacher.";
  if (!aiEnabled()) return "AI is off right now, so the tutor can't answer.";
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if ((await db.aiUsage.count({ where: { kind: "STUDY", createdAt: { gte: start } } })) >= DAILY_STUDY_LIMIT) return "The daily AI limit has been reached. Try again tomorrow.";
  return null;
}
