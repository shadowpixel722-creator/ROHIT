/**
 * Written-quiz mistakes for the Mistake Map. Pure (no database), so it's unit-tested.
 *
 * A "mistake" is a question a student didn't get fully right (partly right, wrong or left blank).
 * It is "still" a mistake while their latest try at that question isn't correct, and "fixed" once it is.
 * Students see their own; teachers get counts only (never names, answers or feedback), with a percentage
 * only when at least MIN_GROUP students have answered the question.
 */
import { MIN_GROUP } from "./progress";
import { toConfidence, type Confidence } from "./confidence";
import type { Verdict } from "./quiz";

export type Mark = { questionId: string; verdict: Verdict; at: number; answer: string; feedback: string; confidence: Confidence | null };
type Attempt = { items: string; answers: string | null; grades: string | null; submittedAt: Date | null; confidence?: string | null };

const parse = <T,>(s: string | null): T | null => {
  try {
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
};

/** Every marked answer in submitted attempts, oldest first. Attempts whose lists don't line up are skipped. */
export function marksFromAttempts(attempts: Attempt[]): Mark[] {
  const out: Mark[] = [];
  for (const a of attempts) {
    if (!a.submittedAt) continue;
    const items = parse<string[]>(a.items);
    const answers = parse<string[]>(a.answers);
    const grades = parse<{ verdict: Verdict; feedback: string }[]>(a.grades);
    if (!items || !answers || !grades || items.length !== grades.length || answers.length !== grades.length) continue;
    // Quizzes from before the confidence check have none; a list that doesn't line up is ignored.
    const sure = parse<unknown[]>(a.confidence ?? null);
    const conf = sure && sure.length === items.length ? sure.map(toConfidence) : null;
    items.forEach((questionId, i) => out.push({ questionId, verdict: grades[i].verdict, at: a.submittedAt!.getTime(), answer: answers[i] ?? "", feedback: grades[i].feedback ?? "", confidence: conf?.[i] ?? null }));
  }
  return out.sort((x, y) => x.at - y.at);
}

export type QuestionMistake = {
  questionId: string;
  tries: number;
  misses: number;
  /** latest try isn't correct */
  still: boolean;
  latest: Verdict;
  /** missed (true) or right (false) per try, oldest first */
  history: boolean[];
  /** the most recent try that wasn't correct: what they wrote, the feedback and how sure they were */
  lastWrong: { verdict: Verdict; answer: string; feedback: string; confidence: Confidence | null };
  /** tries that weren't correct although the student said they were sure */
  sureMisses: number;
  at: number;
};

const missed = (v: Verdict) => v !== "CORRECT";

/** One student's written-quiz mistakes: only questions they've missed at least once; still-wrong first. */
export function studentQuestionMistakes(marks: Mark[]): QuestionMistake[] {
  const by = new Map<string, Mark[]>();
  for (const m of marks) (by.get(m.questionId) ?? by.set(m.questionId, []).get(m.questionId)!).push(m);
  const out: QuestionMistake[] = [];
  for (const [questionId, list] of by) {
    const wrong = list.filter((m) => missed(m.verdict));
    if (wrong.length === 0) continue;
    const latest = list[list.length - 1];
    const lw = wrong[wrong.length - 1];
    out.push({
      questionId, tries: list.length, misses: wrong.length, still: missed(latest.verdict), latest: latest.verdict,
      history: list.map((m) => missed(m.verdict)), lastWrong: { verdict: lw.verdict, answer: lw.answer, feedback: lw.feedback, confidence: lw.confidence }, at: latest.at,
      sureMisses: wrong.filter((m) => m.confidence === "SURE").length,
    });
  }
  return out.sort((a, b) => Number(b.still) - Number(a.still) || Number(b.sureMisses > 0) - Number(a.sureMisses > 0) || b.misses - a.misses || b.at - a.at);
}

/** `sureMissed`: students who missed it at least once while saying they were sure. */
export type ClassQuestion = { questionId: string; answered: number; missed: number; still: number; fixed: number; tries: number; percent: number | null; sureMissed: number };

/** Per question, across students (one list of marks per student). Only questions someone has missed. */
export function classQuestionMap(perStudent: Mark[][]): ClassQuestion[] {
  const by = new Map<string, ClassQuestion>();
  for (const marks of perStudent) {
    const seen = new Map<string, Mark[]>();
    for (const m of marks) (seen.get(m.questionId) ?? seen.set(m.questionId, []).get(m.questionId)!).push(m);
    for (const [questionId, list] of seen) {
      const q = by.get(questionId) ?? { questionId, answered: 0, missed: 0, still: 0, fixed: 0, tries: 0, percent: null, sureMissed: 0 };
      q.answered++;
      q.tries += list.length;
      if (list.some((m) => missed(m.verdict))) {
        q.missed++;
        if (list.some((m) => missed(m.verdict) && m.confidence === "SURE")) q.sureMissed++;
        if (missed(list[list.length - 1].verdict)) q.still++;
        else q.fixed++;
      }
      by.set(questionId, q);
    }
  }
  return [...by.values()]
    .filter((q) => q.missed > 0)
    .map((q) => ({ ...q, percent: q.answered >= MIN_GROUP ? Math.round((q.missed / q.answered) * 100) : null }))
    .sort((a, b) => b.still - a.still || b.missed - a.missed);
}

/** "2 of 3 students (67%) missed it · 1 still does" (no percentage below MIN_GROUP students). */
export function classQuestionSentence(q: Pick<ClassQuestion, "answered" | "missed" | "still" | "percent">) {
  const share = `${q.missed} of ${q.answered} student${q.answered === 1 ? "" : "s"}${q.percent !== null ? ` (${q.percent}%)` : ""} missed it`;
  return `${share} · ${q.still ? `${q.still} still ${q.still === 1 ? "does" : "do"}` : "all fixed it since"}`;
}
