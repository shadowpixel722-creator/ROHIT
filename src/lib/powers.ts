/**
 * Who can run a class, room or personal space (product owner, 2026-11-19: student < student rooms < classrooms).
 *  - CLASS: made by a teacher. Teachers (creator and approved co-teachers) can do everything.
 *  - ROOM: a student room. Its creator is the "student head": a student who can also organise and moderate.
 *    Teachers can join as supervisors with only the powers the head gives them.
 *  - PERSONAL: one student's own space for using every study feature without a class.
 * Reviewing notes, consent forms and homework stay classroom-only (they need a teacher).
 */
export type ClassKind = "CLASS" | "ROOM" | "PERSONAL";
export type Power = "syllabus" | "members" | "moderate" | "study" | "settings";

export const ALL_POWERS: Power[] = ["syllabus", "members", "moderate", "study", "settings"];
/** What a student head can do in their room. */
export const HEAD_POWERS: Power[] = ["syllabus", "members", "moderate", "settings"];
/** What a student can do in their own space. */
export const PERSONAL_POWERS: Power[] = ["syllabus", "study", "settings"];
/** The powers a head can hand to a supervising teacher (never settings: renaming, AI, deleting stay with the head). */
export const SUPERVISOR_POWERS: Power[] = ["syllabus", "members", "moderate"];

export const POWER_LABELS: Record<Power, string> = {
  syllabus: "Edit subjects and chapters",
  members: "Invite and remove members",
  moderate: "Hide notes and delete comments",
  study: "Make flashcards, quizzes and test dates",
  settings: "Change settings",
};

export const kindOf = (kind: string): ClassKind => (kind === "ROOM" || kind === "PERSONAL" ? kind : "CLASS");

/** Reads a supervisor's stored powers, keeping only ones a head is allowed to give. */
export function parsePowers(stored: string | null | undefined): Power[] {
  const wanted = new Set((stored ?? "").split(",").map((p) => p.trim()));
  return SUPERVISOR_POWERS.filter((p) => wanted.has(p));
}

export const formatPowers = (powers: readonly string[]) => parsePowers(powers.join(","));

/**
 * The powers someone has.
 *  who: "teacher" (class creator or co-teacher), "owner" (head or personal owner), "supervisor", "student".
 */
export function powersFor(kind: ClassKind, who: "teacher" | "owner" | "supervisor" | "student", stored?: string): Power[] {
  if (kind === "CLASS") return who === "teacher" ? ALL_POWERS : [];
  if (who === "owner") return kind === "ROOM" ? HEAD_POWERS : PERSONAL_POWERS;
  if (who === "supervisor" && kind === "ROOM") return parsePowers(stored);
  return [];
}

/** What to call a place of this kind in sentences ("this class", "this room"). */
export const placeNoun = (kind: ClassKind) => (kind === "CLASS" ? "class" : kind === "ROOM" ? "room" : "space");
