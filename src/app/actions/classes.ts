"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, requireOwner, requireTeacher } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { getCurrentUser, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeClassStorage } from "@/lib/files";
import { switchIndexGrade } from "@/lib/ncert-sync";
import { generateJoinCode, normalizeJoinCode } from "@/lib/join-code";
import { record, tooMany } from "@/lib/rate-limit";
import { classroomSchema } from "@/lib/validation";

const done = () => revalidatePath("/", "layout");

async function requireRole(role: "TEACHER" | "STUDENT") {
  const user = await getCurrentUser();
  if (!user) throw new UserError("Your session has expired. Please sign in again.");
  if (user.role !== role) throw new UserError(role === "TEACHER" ? "Only teachers can do that." : "Only students can do that.");
  return user;
}

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    if (!(await db.classroom.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique join code");
}

export async function createClass(input: unknown) {
  return run(async () => {
    const teacher = await requireRole("TEACHER");
    const d = classroomSchema.parse(input);
    if ((await db.classroom.count({ where: { teacherId: teacher.id } })) >= 50) throw new UserError("You can have up to 50 classes.");
    const c = await db.classroom.create({ data: { ...d, teacherId: teacher.id, joinCode: await uniqueCode() } });
    done();
    return { id: c.id };
  });
}

export async function updateClass(id: string, input: unknown) {
  return run(async () => {
    const userId = await requireUserId();
    const { classroom } = await requireTeacher(userId, id);
    const d = classroomSchema.parse(input);
    await db.classroom.update({ where: { id }, data: d });
    // A different class means different NCERT books: switch chapter lists (chapters with notes are kept).
    const chapters = d.grade !== classroom.grade ? await switchIndexGrade(id, classroom.grade, d.grade) : null;
    done();
    return { chapters };
  });
}

export async function regenerateJoinCode(id: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, id);
    const joinCode = await uniqueCode();
    await db.classroom.update({ where: { id }, data: { joinCode } });
    done();
    return { joinCode };
  });
}

export async function setJoinOpen(id: string, open: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    await requireTeacher(userId, id);
    await db.classroom.update({ where: { id }, data: { joinOpen: Boolean(open) } });
    done();
  });
}

export async function deleteClass(id: string, confirmName: string) {
  const res = await run(async () => {
    const userId = await requireUserId();
    const { classroom } = await requireOwner(userId, id);
    if (confirmName.trim() !== classroom.name) throw new UserError("Type the class name exactly to confirm.");
    await db.classroom.delete({ where: { id } });
    await removeClassStorage(id);
    done();
  });
  if (res.ok) redirect("/classes");
  return res;
}

/**
 * Join with a class code.
 *  - Students join straight away.
 *  - Teachers send a request; the class's teacher approves it (anyone can sign up as a "teacher",
 *    so a code alone must never grant teacher access).
 */
export async function joinClass(code: string) {
  return run(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UserError("Your session has expired. Please sign in again.");
    const key = `join:${user.id}`;
    if (tooMany(key, 10, 10 * 60 * 1000)) throw new UserError("Too many attempts. Wait a few minutes and try again.");
    const normalized = normalizeJoinCode(String(code ?? ""));
    const classroom = normalized ? await db.classroom.findUnique({ where: { joinCode: normalized } }) : null;
    if (!classroom) {
      record(key);
      throw new UserError("That code doesn't match any class. Check it with your teacher.");
    }
    if (classroom.teacherId === user.id) throw new UserError("You created this class. Open it from your class list.");
    if (!classroom.joinOpen) throw new UserError("This class isn't accepting new members right now. Ask the class teacher.");
    const existing = await db.membership.findUnique({ where: { classroomId_userId: { classroomId: classroom.id, userId: user.id } } });
    if (user.role === "TEACHER") {
      if (existing?.status === "ACTIVE") return { id: classroom.id, name: classroom.name, pending: false };
      if (!existing) await db.membership.create({ data: { classroomId: classroom.id, userId: user.id, role: "TEACHER", status: "PENDING" } });
      done();
      return { id: classroom.id, name: classroom.name, pending: true };
    }
    if (!existing) await db.membership.create({ data: { classroomId: classroom.id, userId: user.id } });
    done();
    return { id: classroom.id, name: classroom.name, pending: false };
  });
}

/** Class owner approves or declines a teacher's request to co-teach. */
export async function decideTeacherRequest(membershipId: string, approve: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: { select: { name: true } } } });
    if (!m || m.role !== "TEACHER" || m.status !== "PENDING") throw new UserError("Request not found.");
    await requireOwner(userId, m.classroomId);
    if (approve) await db.membership.update({ where: { id: membershipId }, data: { status: "ACTIVE", joinedAt: new Date() } });
    else await db.membership.delete({ where: { id: membershipId } });
    done();
    return { name: m.user.name };
  });
}

/** Class owner removes a co-teacher (or a teacher withdraws their own pending request). */
export async function removeTeacher(membershipId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.role !== "TEACHER") throw new UserError("Teacher not found.");
    if (m.userId !== userId) await requireOwner(userId, m.classroomId);
    await db.membership.delete({ where: { id: membershipId } });
    done();
  });
}

export async function leaveClass(classroomId: string) {
  const res = await run(async () => {
    const userId = await requireUserId();
    const { isOwner } = await requireMember(userId, classroomId);
    if (isOwner) throw new UserError("You created this class, so you can't leave it. Delete it instead.");
    await db.membership.delete({ where: { classroomId_userId: { classroomId, userId } } });
    done();
  });
  if (res.ok) redirect("/classes");
  return res;
}

export async function removeStudent(membershipId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.role !== "STUDENT") throw new UserError("Student not found.");
    await requireTeacher(userId, m.classroomId);
    await db.membership.delete({ where: { id: membershipId } });
    done();
  });
}

/** Teacher confirms they hold a signed guardian consent form for this student. */
export async function setConsentVerified(membershipId: string, verified: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.membership.findUnique({ where: { id: membershipId } });
    if (!m || m.role !== "STUDENT") throw new UserError("Student not found.");
    await requireTeacher(userId, m.classroomId);
    // Without consent a student can't upload, so withdrawing it also withdraws upload permission.
    await db.membership.update({ where: { id: membershipId }, data: verified ? { consentVerifiedAt: new Date() } : { consentVerifiedAt: null, canUpload: false } });
    done();
  });
}

/** Teacher approves (or stops) a student uploading notes. Requires a confirmed consent form. */
export async function setCanUpload(membershipId: string, allowed: boolean) {
  return run(async () => {
    const userId = await requireUserId();
    const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: { select: { name: true } } } });
    if (!m || m.role !== "STUDENT") throw new UserError("Student not found.");
    await requireTeacher(userId, m.classroomId);
    if (allowed && !m.consentVerifiedAt) throw new UserError(`Confirm ${m.user.name}'s consent form first. Their notes couldn't be shared otherwise.`);
    await db.membership.update({ where: { id: membershipId }, data: { canUpload: Boolean(allowed) } });
    done();
  });
}
