"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { run, UserError } from "@/lib/action";
import { destroySession, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeClassStorage, removeUploads } from "@/lib/files";

export async function updateName(name: string) {
  return run(async () => {
    const userId = await requireUserId();
    const n = z.string().trim().min(1, "Please enter your name").max(80).parse(name);
    await db.user.update({ where: { id: userId }, data: { name: n } });
    revalidatePath("/", "layout");
  });
}

export async function changePassword(current: string, next: string) {
  return run(async () => {
    const userId = await requireUserId();
    z.string().min(8, "New password must be at least 8 characters").max(200).parse(next);
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new UserError("Your current password is incorrect.");
    await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  });
}

export async function deleteAccount(confirmEmail: string) {
  const res = await run(async () => {
    const userId = await requireUserId();
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (confirmEmail.trim().toLowerCase() !== user.email) throw new UserError("Type your email address exactly to confirm.");
    // Teachers' classes (and everything in them) are deleted with the account via cascade.
    // Collect files first: the rows disappear with the account (cascade).
    const [ownImages, ownAttachments, classes] = await Promise.all([
      db.noteImage.findMany({ where: { note: { authorId: userId } }, select: { filePath: true } }),
      db.noteAttachment.findMany({ where: { note: { authorId: userId } }, select: { filePath: true } }),
      db.classroom.findMany({ where: { teacherId: userId }, select: { id: true } }),
    ]);
    await destroySession();
    await db.user.delete({ where: { id: userId } });
    await removeUploads([...ownImages, ...ownAttachments].map((i) => i.filePath));
    await Promise.all(classes.map((c) => removeClassStorage(c.id)));
  });
  if (res.ok) redirect("/register");
  return res;
}
