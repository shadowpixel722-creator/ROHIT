"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardQuietly } from "@/lib/game-server";

/** Ticks (or unticks) a task in your study plan. The first tick of each task gives a little XP. */
export async function togglePlanTask(classroomId: string, key: string, done: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    await requireMember(userId, classroomId);
    const k = z.string().regex(/^[a-z0-9]+:(c[a-z0-9]+|r\d)$/i).parse(key);
    const assessment = await db.assessment.findFirst({ where: { id: k.split(":")[0], classroomId }, select: { id: true } });
    if (!assessment) throw new UserError("That test is no longer on the calendar.");
    if (done) {
      await db.planDone.upsert({ where: { userId_key: { userId, key: k } }, create: { userId, key: k }, update: {} });
      await awardQuietly(userId, { xp: 3, once: `plan:${k}` });
    } else await db.planDone.deleteMany({ where: { userId, key: k } });
    revalidatePath(`/classes/${classroomId}/calendar`);
    return { done };
  });
}
