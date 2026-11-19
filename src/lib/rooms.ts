import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { generateJoinCode } from "./join-code";

export async function uniqueJoinCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    if (!(await db.classroom.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique join code");
}

/** A student's own space (made the first time they need it). Teachers don't have one. */
export async function ensurePersonalSpace(user: { id: string; role: string }) {
  if (user.role !== "STUDENT") return null;
  const found = await db.classroom.findUnique({ where: { personalOf: user.id }, select: { id: true } });
  if (found) return found.id;
  try {
    const c = await db.classroom.create({
      // Nobody can join a personal space: joining is closed and the join flow refuses PERSONAL codes.
      data: { name: "My space", kind: "PERSONAL", personalOf: user.id, teacherId: user.id, joinCode: await uniqueJoinCode(), joinOpen: false, members: { create: { userId: user.id } } },
      select: { id: true },
    });
    return c.id;
  } catch (e) {
    // Two requests raced to make it: the other one won.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return (await db.classroom.findUniqueOrThrow({ where: { personalOf: user.id }, select: { id: true } })).id;
    }
    throw e;
  }
}
