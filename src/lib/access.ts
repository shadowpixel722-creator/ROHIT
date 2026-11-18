import "server-only";
import { UserError } from "./action";
import { db } from "./db";

export type ClassRole = "TEACHER" | "STUDENT";

/**
 * The user's role in a class, or null if they have no access.
 *  - the class creator (Classroom.teacherId) is a TEACHER and the owner
 *  - an ACTIVE membership with role TEACHER is a co-teacher (TEACHER, not owner)
 *  - an ACTIVE student membership is a STUDENT
 *  - PENDING teacher requests give no access
 * "Not found" and "no access" look the same to the caller, so class IDs can't be probed.
 */
export async function getClassAccess(userId: string, classroomId: string) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    include: { members: { where: { userId }, select: { id: true, consentVerifiedAt: true, canUpload: true, role: true, status: true } } },
  });
  if (!classroom) return null;
  if (classroom.teacherId === userId) return { classroom, role: "TEACHER" as ClassRole, isOwner: true, membership: null };
  const membership = classroom.members[0];
  if (!membership || membership.status !== "ACTIVE") return null;
  if (membership.role === "TEACHER") return { classroom, role: "TEACHER" as ClassRole, isOwner: false, membership: null };
  return { classroom, role: "STUDENT" as ClassRole, isOwner: false, membership };
}

export async function requireMember(userId: string, classroomId: string) {
  const access = await getClassAccess(userId, classroomId);
  if (!access) throw new UserError("Class not found.");
  return access;
}

/** Class teacher: the owner or an approved co-teacher. */
export async function requireTeacher(userId: string, classroomId: string) {
  const access = await getClassAccess(userId, classroomId);
  if (!access) throw new UserError("Class not found.");
  if (access.role !== "TEACHER") throw new UserError("Only the class teacher can do that.");
  return access;
}

/** Only the teacher who created the class (delete class, manage co-teachers). */
export async function requireOwner(userId: string, classroomId: string) {
  const access = await requireTeacher(userId, classroomId);
  if (!access.isOwner) throw new UserError("Only the teacher who created this class can do that.");
  return access;
}

/** Subject → class, checked against the teacher. */
export async function requireTeacherOfSubject(userId: string, subjectId: string) {
  const s = await db.subject.findUnique({ where: { id: subjectId }, select: { classroomId: true } });
  if (!s) throw new UserError("Subject not found.");
  await requireTeacher(userId, s.classroomId);
  return s;
}

export async function requireTeacherOfChapter(userId: string, chapterId: string) {
  const c = await db.chapter.findUnique({ where: { id: chapterId }, select: { subjectId: true, subject: { select: { classroomId: true } } } });
  if (!c) throw new UserError("Chapter not found.");
  await requireTeacher(userId, c.subject.classroomId);
  return c;
}
