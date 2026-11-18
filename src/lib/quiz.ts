/**
 * Pure quiz and readiness logic (no database, no Next.js), so it is easy to unit-test.
 * Quizzes are written answers: the student answers in their own words and the AI judges the
 * meaning against the teacher-approved model answer. The server builds each quiz from APPROVED
 * questions and keeps the question set, so nothing the browser sends can change a question or its key.
 */
import type { Confidence } from "./confidence";

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many questions to ask for the notes a student says they studied: 2 per note, between 4 and 10 (written answers take longer). */
export const quizSize = (noteCount: number) => Math.min(10, Math.max(4, noteCount * 2));

export const MIN_QUIZ_QUESTIONS = 3;

/**
 * Picks `count` questions, spread fairly across the notes studied. Within a note, questions the
 * student has not seen before come first, so a retry gives fresh questions while any remain.
 */
export function pickQuestions(pool: { id: string; noteId: string | null }[], seen: ReadonlySet<string>, count: number, rng: Rng = Math.random): string[] {
  const groups = new Map<string, string[]>();
  for (const q of shuffle(pool, rng)) {
    const key = q.noteId ?? "";
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(q.id);
  }
  // Unseen first (stable, so the shuffle above still decides the order inside each half).
  const queues = shuffle([...groups.values()], rng).map((ids) => [...ids.filter((id) => !seen.has(id)), ...ids.filter((id) => seen.has(id))]);
  const picked: string[] = [];
  while (picked.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      const id = q.shift();
      if (id !== undefined && picked.length < count) picked.push(id);
    }
  }
  return shuffle(picked, rng);
}

/** How a written answer was judged. SKIPPED = left blank (never sent to the AI). */
export type Verdict = "CORRECT" | "PARTLY" | "INCORRECT" | "SKIPPED";
export const VERDICTS = ["CORRECT", "PARTLY", "INCORRECT"] as const;

export type Grade = { verdict: Verdict; feedback: string };

export const POINTS: Record<Verdict, number> = { CORRECT: 1, PARTLY: 0.5, INCORRECT: 0, SKIPPED: 0 };
export const VERDICT_LABEL: Record<Verdict, string> = { CORRECT: "Correct", PARTLY: "Partly correct", INCORRECT: "Not quite", SKIPPED: "Skipped" };

export const pointsOf = (grades: readonly Grade[]) => grades.reduce((s, g) => s + POINTS[g.verdict], 0);

/** Longest written answer we accept (and send to the AI). */
export const MAX_ANSWER_CHARS = 600;
/** A blank or one-word answer isn't worth sending to the AI. */
export const isBlank = (answer: string) => answer.replace(/\s+/g, " ").trim().length < 2;

/** Per-note points for the results page. */
export function noteBreakdown(questionIds: readonly string[], grades: readonly Grade[], noteIdById: ReadonlyMap<string, string | null>) {
  const out = new Map<string, { points: number; total: number }>();
  questionIds.forEach((id, i) => {
    const key = noteIdById.get(id) ?? "";
    const row = out.get(key) ?? { points: 0, total: 0 };
    row.total++;
    row.points += POINTS[grades[i]?.verdict ?? "INCORRECT"];
    out.set(key, row);
  });
  return out;
}

export const WEAK_BELOW = 0.6;

/** Chapter mastery, 0–100: the average of the last three quiz scores (newest first), or null if none. */
export function mastery(attemptsNewestFirst: { score: number; total: number }[]): number | null {
  const recent = attemptsNewestFirst.filter((a) => a.total > 0).slice(0, 3);
  if (recent.length === 0) return null;
  return Math.round((recent.reduce((s, a) => s + a.score / a.total, 0) / recent.length) * 100);
}

export type ReadinessLevel = "NOT_STARTED" | "NEEDS_WORK" | "ALMOST" | "READY";

export const levelOf = (percent: number | null): ReadinessLevel =>
  percent === null ? "NOT_STARTED" : percent >= 80 ? "READY" : percent >= 50 ? "ALMOST" : "NEEDS_WORK";

export const LEVEL_LABEL: Record<ReadinessLevel, string> = { NOT_STARTED: "Not started", NEEDS_WORK: "Needs work", ALMOST: "Almost ready", READY: "Ready" };

/** Readiness for a test or exam: the average over its chapters, counting a chapter with no quiz yet as 0. */
export function assessmentReadiness(chapterPercents: (number | null)[]): { percent: number | null; level: ReadinessLevel } {
  if (chapterPercents.length === 0 || chapterPercents.every((p) => p === null)) return { percent: null, level: "NOT_STARTED" };
  const percent = Math.round(chapterPercents.reduce<number>((s, p) => s + (p ?? 0), 0) / chapterPercents.length);
  return { percent, level: levelOf(percent) };
}

/** What the browser is shown while taking a quiz: just the questions, never the model answers. */
export type QuizQuestionView = { id: string; question: string };

/** What the student sees after submitting. */
export type QuizResult = {
  points: number;
  total: number;
  percent: number;
  questions: { question: string; answer: string; verdict: Verdict; feedback: string; modelAnswer: string; confidence: Confidence | null }[];
  notes: { noteId: string; title: string; points: number; total: number; weak: boolean }[];
};
