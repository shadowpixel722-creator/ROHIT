/**
 * Confidence check: before seeing whether an answer is right, a student says how sure they are.
 * Used for multiple-choice practice and written quizzes, and fed into the Mistake Map:
 *  - wrong while SURE   → a real misconception, not a slip (shown first)
 *  - right while unsure → shaky: right this time, but not yet secure
 *  - a trap avoided by GUESSING doesn't count towards "fixed"
 * Pure (no database), so it is unit-tested. Confidence is the student's own data: they see theirs,
 * teachers see counts only, and it is never sent to the AI.
 */
export const CONFIDENCES = ["SURE", "UNSURE", "GUESS"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const CONFIDENCE_LABEL: Record<Confidence, string> = { SURE: "Sure", UNSURE: "Think so", GUESS: "Guessing" };
export const CONFIDENCE_HINT: Record<Confidence, string> = {
  SURE: "I know this",
  UNSURE: "Fairly sure, not certain",
  GUESS: "No real idea",
};

export const isConfidence = (v: unknown): v is Confidence => typeof v === "string" && (CONFIDENCES as readonly string[]).includes(v);
export const toConfidence = (v: unknown): Confidence | null => (isConfidence(v) ? v : null);

/** One answered question, from either multiple choice or a written quiz. */
export type Answered = { confidence: Confidence | null; correct: boolean };

export type Calibration = Record<Confidence, { total: number; right: number }> & { rated: number };

/** How often the student was right at each level of confidence (answers without a rating are left out). */
export function calibration(answers: Answered[]): Calibration {
  const out: Calibration = { SURE: { total: 0, right: 0 }, UNSURE: { total: 0, right: 0 }, GUESS: { total: 0, right: 0 }, rated: 0 };
  for (const a of answers) {
    if (!a.confidence) continue;
    out[a.confidence].total++;
    if (a.correct) out[a.confidence].right++;
    out.rated++;
  }
  return out;
}

export const percent = (right: number, total: number) => (total === 0 ? null : Math.round((right / total) * 100));

/** Below this many rated answers we don't judge how well the student knows their own knowledge. */
export const MIN_RATED = 5;

/**
 * One plain sentence about how well confidence matches results, e.g. "When you're sure, you're right
 * 9 times in 10. When you guess, you're right 3 times in 10." plus a tip when there's something to act on.
 */
export function calibrationAdvice(c: Calibration): { headline: string; tip: string | null } | null {
  if (c.rated < MIN_RATED) return null;
  const sure = percent(c.SURE.right, c.SURE.total);
  const guess = percent(c.GUESS.right + c.UNSURE.right, c.GUESS.total + c.UNSURE.total);
  const parts: string[] = [];
  if (sure !== null) parts.push(`When you're sure, you're right ${sure}% of the time.`);
  if (guess !== null) parts.push(`When you're not sure, you're right ${guess}% of the time.`);
  const sureWrong = c.SURE.total - c.SURE.right;
  let tip: string | null = null;
  if (sure !== null && c.SURE.total >= 3 && sure < 70) tip = `You were sure but wrong ${sureWrong} time${sureWrong === 1 ? "" : "s"}. Those are the mistakes to fix first: the ideas you believe but have wrong.`;
  else if (guess !== null && c.GUESS.total + c.UNSURE.total >= 3 && guess >= 75) tip = "You often know more than you think. Trust yourself a little more.";
  else if (sure !== null && sure >= 85) tip = "Your confidence is a good guide: when you feel sure, you usually are right.";
  return { headline: parts.join(" "), tip };
}

/* ------------------------------------------------------------------ topics */

export type TopicStatus = "STRONG" | "SHAKY" | "NEEDS_WORK" | "NOT_STARTED";

export const TOPIC_LABEL: Record<TopicStatus, string> = { STRONG: "Strong", SHAKY: "Shaky", NEEDS_WORK: "Needs work", NOT_STARTED: "Not practised yet" };

/** How many of a topic's most recent answers decide its status. */
export const RECENT = 10;

export type TopicStats = {
  answered: number;
  right: number;
  /** Wrong while sure (most recent RECENT answers) */
  sureWrong: number;
  /** Right while unsure or guessing (most recent RECENT answers) */
  shakyRight: number;
  /** Share right, most recent RECENT answers (0–100), null when not practised */
  recentPercent: number | null;
  status: TopicStatus;
};

/**
 * A topic's status from its answers (oldest first) and its traps:
 *  - NEEDS_WORK: an active trap, under 60% right recently, or wrong while sure more than once recently
 *  - SHAKY: a fading trap, under 80% right, or a third or more of recent right answers were unsure guesses
 *  - STRONG: otherwise
 */
export function topicStats(answersOldestFirst: Answered[], traps: { status: string }[] = []): TopicStats {
  const recent = answersOldestFirst.slice(-RECENT);
  const right = answersOldestFirst.filter((a) => a.correct).length;
  if (recent.length === 0) return { answered: 0, right: 0, sureWrong: 0, shakyRight: 0, recentPercent: null, status: "NOT_STARTED" };
  const recentRight = recent.filter((a) => a.correct);
  const sureWrong = recent.filter((a) => !a.correct && a.confidence === "SURE").length;
  const shakyRight = recentRight.filter((a) => a.confidence === "UNSURE" || a.confidence === "GUESS").length;
  const p = Math.round((recentRight.length / recent.length) * 100);
  let status: TopicStatus = "STRONG";
  if (traps.some((t) => t.status === "ACTIVE") || p < 60 || sureWrong >= 2) status = "NEEDS_WORK";
  else if (traps.some((t) => t.status === "FADING") || p < 80 || (recentRight.length > 0 && shakyRight / recentRight.length >= 1 / 3)) status = "SHAKY";
  return { answered: answersOldestFirst.length, right, sureWrong, shakyRight, recentPercent: p, status };
}

/** "8 of 10 right recently · 2 right by guessing · wrong while sure once" */
export function topicSentence(s: TopicStats) {
  if (s.status === "NOT_STARTED") return "Not practised yet.";
  const recent = Math.min(s.answered, RECENT);
  const parts = [`${Math.round(((s.recentPercent ?? 0) * recent) / 100)} of ${recent} right recently`];
  if (s.shakyRight) parts.push(`${s.shakyRight} right but not sure`);
  if (s.sureWrong) parts.push(`wrong while sure ${s.sureWrong === 1 ? "once" : `${s.sureWrong} times`}`);
  return parts.join(" · ");
}
