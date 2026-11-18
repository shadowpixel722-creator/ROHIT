/**
 * Mistake Map: pure logic (no database), so it is easy to unit-test.
 *
 * Every wrong option of a practice MCQ can be tagged with a misconception. Each time a student answers a
 * question that contains a trap for misconception M, that's one "chance" to fall for M; picking that option
 * is a "fall". From the sequence of chances we work out whether the trap is still active or fading away.
 */
import type { Confidence } from "./confidence";
import { MIN_GROUP } from "./progress";

export type TrapStatus = "ACTIVE" | "FADING" | "FIXED" | "CLEAR";

/** Chances avoided in a row after the last fall before a trap counts as fixed. */
export const FIXED_AFTER = 3;

export const STATUS_LABEL: Record<TrapStatus, string> = { ACTIVE: "Active trap", FADING: "Fading", FIXED: "Fixed", CLEAR: "Not a problem" };

/**
 * `fellOldestFirst[i]` is true when the student fell for the trap at chance i.
 *  - CLEAR: never fell for it
 *  - ACTIVE: fell for it at the most recent chance
 *  - FADING: avoided it since the last fall, but fewer than FIXED_AFTER times
 *  - FIXED: avoided it FIXED_AFTER or more times in a row since the last fall
 */
export function statusOf(fellOldestFirst: boolean[]): TrapStatus {
  const last = fellOldestFirst.lastIndexOf(true);
  if (last === -1) return "CLEAR";
  const avoidedSince = fellOldestFirst.length - 1 - last;
  if (avoidedSince === 0) return "ACTIVE";
  return avoidedSince >= FIXED_AFTER ? "FIXED" : "FADING";
}

/** `confidence`: how sure the student said they were (null for answers from before the confidence check). */
export type Chance = { misconceptionId: string; fell: boolean; at: number; chapter: string; subject: string; confidence?: Confidence | null };

export type Trap = {
  misconceptionId: string;
  chances: number;
  falls: number;
  /** Chances avoided in a row since the last fall. */
  avoidedSince: number;
  status: TrapStatus;
  /** Where the chances came from: one chapter's name, or the subject when they span chapters. */
  scope: string;
  /** Fell (true) or avoided (false), oldest first, for a small history strip. */
  history: boolean[];
  /** Times fallen for while the student said they were sure: a real misconception, not a slip. */
  sureFalls: number;
  /** Times avoided only by guessing; these don't count towards fixing the trap. */
  luckyAvoids: number;
};

const ORDER: Record<TrapStatus, number> = { ACTIVE: 0, FADING: 1, FIXED: 2, CLEAR: 3 };

/** Only mistakes actually made: traps the student has fallen for at least once. */
export const madeMistakes = (traps: Trap[]) => traps.filter((t) => t.falls > 0);

/**
 * One student's traps, worst first: active traps (those fallen for while sure first) by how often they're
 * fallen for, then fading, fixed and clear. Avoiding a trap by guessing isn't progress, so those chances are
 * left out when working out the status (they still show in the history strip).
 */
export function profile(chances: Chance[]): Trap[] {
  const byM = new Map<string, Chance[]>();
  for (const c of [...chances].sort((a, b) => a.at - b.at)) (byM.get(c.misconceptionId) ?? byM.set(c.misconceptionId, []).get(c.misconceptionId)!).push(c);
  return [...byM.entries()]
    .map(([misconceptionId, list]) => {
      const history = list.map((c) => c.fell);
      const counted = list.filter((c) => c.fell || c.confidence !== "GUESS").map((c) => c.fell);
      const last = counted.lastIndexOf(true);
      const chapters = new Set(list.map((c) => c.chapter));
      return {
        misconceptionId,
        chances: list.length,
        falls: history.filter(Boolean).length,
        avoidedSince: last === -1 ? counted.length : counted.length - 1 - last,
        status: statusOf(counted),
        scope: chapters.size === 1 ? list[0].chapter : list[0].subject,
        history,
        sureFalls: list.filter((c) => c.fell && c.confidence === "SURE").length,
        luckyAvoids: list.filter((c) => !c.fell && c.confidence === "GUESS").length,
      };
    })
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || Number(b.sureFalls > 0) - Number(a.sureFalls > 0) || b.falls / b.chances - a.falls / a.chances || b.falls - a.falls);
}

/** "You were sure 2 of the 3 times you fell for it: you believe this idea, so it needs fixing first." */
export function trapConfidenceNote(t: Pick<Trap, "sureFalls" | "falls" | "luckyAvoids">) {
  const parts: string[] = [];
  if (t.sureFalls > 0) parts.push(`You were sure ${t.sureFalls === t.falls ? (t.falls === 1 ? "the time" : `all ${t.falls} times`) : `${t.sureFalls} of the ${t.falls} times`} you fell for it: you believe this idea, so fix it first.`);
  if (t.luckyAvoids > 0) parts.push(`${t.luckyAvoids} time${t.luckyAvoids === 1 ? "" : "s"} you avoided it by guessing, which doesn't count towards fixing it.`);
  return parts.join(" ") || null;
}

/** "You pick the “distance instead of displacement” trap in 6 of 8 Motion questions." */
export function trapSentence(label: string, t: Pick<Trap, "falls" | "chances" | "scope">) {
  // "5. Exploring Forces" reads better as "Exploring Forces" mid-sentence.
  const scope = t.scope.replace(/^\s*(?:chapter\s*)?\d+\s*[.:)\-–]\s*/i, "");
  return `You pick the “${label}” trap in ${t.falls} of ${t.chances} ${scope} question${t.chances === 1 ? "" : "s"}.`;
}

/** What changed since the trap was last fallen for, in one short line. */
export function trapProgress(t: Pick<Trap, "status" | "avoidedSince">) {
  if (t.status === "ACTIVE") return "You fell for it last time. Practise it to break it.";
  if (t.status === "FADING") return `Avoided it ${t.avoidedSince} time${t.avoidedSince === 1 ? "" : "s"} in a row. ${FIXED_AFTER - t.avoidedSince} more to fix it.`;
  if (t.status === "FIXED") return `Avoided it ${t.avoidedSince} times in a row since you last fell for it.`;
  return "You've avoided this trap every time.";
}

export type ClassTrap = {
  misconceptionId: string;
  /** Students who answered at least one question with this trap in it */
  met: number;
  /** ...of whom fell for it at least once */
  fell: number;
  /** ...of whom fell for it at their most recent chance (still making the mistake) */
  active: number;
  /** ...of whom have since avoided it 3+ times in a row */
  fixed: number;
  /** Total times the trap was picked */
  falls: number;
  /** ...of whom fell for it at least once while sure (a firmly held misconception) */
  sureFell: number;
  /** fell / met, shown only when at least MIN_GROUP students met the trap */
  percent: number | null;
};

/**
 * The class's mistakes: only misconceptions at least one student has actually fallen for, most widespread first.
 * Counts only, never names; the percentage is hidden below MIN_GROUP students.
 */
export function classMap(perStudent: Trap[][]): ClassTrap[] {
  const byM = new Map<string, Trap[]>();
  for (const traps of perStudent) for (const t of traps) (byM.get(t.misconceptionId) ?? byM.set(t.misconceptionId, []).get(t.misconceptionId)!).push(t);
  return [...byM.entries()]
    .map(([misconceptionId, list]) => {
      const fell = list.filter((t) => t.falls > 0).length;
      return {
        misconceptionId, met: list.length, fell,
        active: list.filter((t) => t.status === "ACTIVE").length,
        fixed: list.filter((t) => t.status === "FIXED").length,
        falls: list.reduce((n, t) => n + t.falls, 0),
        sureFell: list.filter((t) => t.sureFalls > 0).length,
        percent: list.length >= MIN_GROUP ? Math.round((fell / list.length) * 100) : null,
      };
    })
    .filter((c) => c.fell > 0)
    .sort((a, b) => b.fell - a.fell || b.active - a.active || b.falls - a.falls);
}

/** "2 of 3 students (67%) fell for this · 1 still does" (no percentage below MIN_GROUP students). */
export function classTrapSentence(c: Pick<ClassTrap, "met" | "fell" | "active" | "percent">) {
  const who = `${c.fell} of ${c.met} student${c.met === 1 ? "" : "s"}${c.percent !== null ? ` (${c.percent}%)` : ""} fell for it`;
  const now = c.active === 0 ? "none still do" : `${c.active} still ${c.active === 1 ? "does" : "do"}`;
  return `${who} · ${now}`;
}

/** Questions to serve for one trap: never-seen first, then ones the student fell for, then the rest. */
export function pickForTrap(pool: { id: string }[], history: Map<string, "fell" | "avoided">, count: number, rng: () => number = Math.random) {
  const shuffled = [...pool].sort(() => rng() - 0.5);
  const rank = (id: string) => (!history.has(id) ? 0 : history.get(id) === "fell" ? 1 : 2);
  return shuffled.sort((a, b) => rank(a.id) - rank(b.id)).slice(0, count).map((q) => q.id);
}
