import "server-only";
import { UserError } from "./action";
import { db } from "./db";
import { kindOf, powersFor, type ClassKind, type Power } from "./powers";

/** TEACHER: runs a classroom. STUDENT: a student (a room's head is a STUDENT with extra powers). SUPERVISOR: a teacher in a student room. */
export type ClassRole = "TEACHER" | "STUDENT" | "SUPERVISOR";

/**
 * The user's role in a class, room or personal space, or null if they have no access.
 *  Classroom: the creator (Classroom.teacherId) is a TEACHER and the owner; an ACTIVE TEACHER membership is a co-teacher;
 *  an ACTIVE student membership is a STUDENT; PENDING teacher requests give no access.
 *  Student room / personal space: everyone has a membership (the creator too, as a STUDENT and the owner). Teachers are
 *  SUPERVISORs once the head approves them.
 * "Not found" and "no access" look the same to the caller, so class IDs can't be probed.
 */
export async function getClassAccess(userId: string, classroomId: string) {
  const classroom = await db.classroom.findUnique({
    where: { id: classroomId },
    include: { members: { where: { userId }, select: { id: true, consentVerifiedAt: true, canUpload: true, role: true, status: true, powers: true, user: { select: { consentAt: true } } } } },
  });
  if (!classroom) return null;
  const kind: ClassKind = kindOf(classroom.kind);
  const m = classroom.members[0];
  const access = (role: ClassRole, isOwner: boolean, membership: typeof m | null, powers: Power[]) => ({ classroom, kind, role, isOwner, membership, powers });

  if (kind === "CLASS") {
    if (classroom.teacherId === userId) return access("TEACHER", true, null, powersFor(kind, "teacher"));
    if (!m || m.status !== "ACTIVE") return null;
    if (m.role === "TEACHER") return access("TEACHER", false, null, powersFor(kind, "teacher"));
    return access("STUDENT", false, m, []);
  }
  if (!m || m.status !== "ACTIVE") return null;
  if (m.role === "TEACHER") return access("SUPERVISOR", false, null, powersFor(kind, "supervisor", m.powers));
  const isOwner = classroom.teacherId === userId;
  // No teacher here to confirm a signed form, so the guardian declaration made at sign-up counts (product owner, 2026-11-19).
  // Members add notes freely; the head (or a supervisor they trust) can hide them.
  const membership = { ...m, consentVerifiedAt: m.user.consentAt, canUpload: true };
  return access("STUDENT", isOwner, membership, powersFor(kind, isOwner ? "owner" : "student"));
}

export type Access = NonNullable<Awaited<ReturnType<typeof getClassAccess>>>;

export const can = (access: { powers: readonly Power[] }, power: Power) => access.powers.includes(power);

export async function requireMember(userId: string, classroomId: string) {
  const access = await getClassAccess(userId, classroomId);
  if (!access) throw new UserError("Class not found.");
  return access;
}

/** Classroom teacher: the owner or an approved co-teacher. Student rooms and personal spaces have none. */
export async function requireTeacher(userId: string, classroomId: string) {
  const access = await getClassAccess(userId, classroomId);
  if (!access) throw new UserError("Class not found.");
  if (access.role !== "TEACHER") throw new UserError(access.kind === "CLASS" ? "Only the class teacher can do that." : "That's only for classrooms with a teacher.");
  return access;
}

const POWER_DENIED: Record<Power, string> = {
  syllabus: "You can't change the subjects and chapters here.",
  members: "You can't manage the members here.",
  moderate: "You can't moderate notes or comments here.",
  study: "You can't make study material here.",
  settings: "You can't change these settings.",
};

/** Someone who holds this power here (a teacher in a classroom; a head, owner or trusted supervisor elsewhere). */
export async function requirePower(userId: string, classroomId: string, power: Power) {
  const access = await getClassAccess(userId, classroomId);
  if (!access) throw new UserError("Class not found.");
  if (!can(access, power)) throw new UserError(access.kind === "CLASS" ? "Only the class teacher can do that." : POWER_DENIED[power]);
  return access;
}

/** Only the creator: the classroom's teacher, the room's student head or the space's owner. */
export async function requireOwner(userId: string, classroomId: string) {
  const access = await requireMember(userId, classroomId);
  if (!access.isOwner)
    throw new UserError(access.kind === "CLASS" ? "Only the teacher who created this class can do that." : access.kind === "ROOM" ? "Only the student head can do that." : "Only the owner can do that.");
  return access;
}

/** Subject → class, checked against a power. */
export async function requirePowerOfSubject(userId: string, subjectId: string, power: Power) {
  const s = await db.subject.findUnique({ where: { id: subjectId }, select: { classroomId: true } });
  if (!s) throw new UserError("Subject not found.");
  await requirePower(userId, s.classroomId, power);
  return s;
}

export async function requirePowerOfChapter(userId: string, chapterId: string, power: Power) {
  const c = await db.chapter.findUnique({ where: { id: chapterId }, select: { subjectId: true, subject: { select: { classroomId: true } } } });
  if (!c) throw new UserError("Chapter not found.");
  await requirePower(userId, c.subject.classroomId, power);
  return c;
}
