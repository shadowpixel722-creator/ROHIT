import { describe, expect, it } from "vitest";
import { classQuestionMap, classQuestionSentence, marksFromAttempts, studentQuestionMistakes, type Mark } from "@/lib/quiz-mistakes";

const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 0, n));
const attempt = (n: number, items: string[], verdicts: string[], answers = items.map((i) => `answer ${i}`)) => ({
  items: JSON.stringify(items), answers: JSON.stringify(answers), submittedAt: at(n),
  grades: JSON.stringify(verdicts.map((verdict) => ({ verdict, feedback: `feedback ${verdict}` }))),
});
const mark = (questionId: string, verdict: Mark["verdict"], n: number): Mark => ({ questionId, verdict, at: n, answer: "", feedback: "", confidence: null });

describe("marksFromAttempts", () => {
  it("reads submitted attempts in time order and skips unsubmitted or misaligned ones", () => {
    const marks = marksFromAttempts([
      attempt(2, ["q1"], ["CORRECT"]),
      attempt(1, ["q1", "q2"], ["INCORRECT", "PARTLY"]),
      { ...attempt(3, ["q3"], ["INCORRECT"]), submittedAt: null },
      attempt(4, ["q4", "q5"], ["INCORRECT"]), // lists don't line up
    ]);
    expect(marks.map((m) => `${m.questionId}:${m.verdict}`)).toEqual(["q1:INCORRECT", "q2:PARTLY", "q1:CORRECT"]);
    expect(marks[0].answer).toBe("answer q1");
  });
});

describe("studentQuestionMistakes", () => {
  it("lists only questions missed at least once, still-wrong first, with the last wrong answer", () => {
    const list = studentQuestionMistakes([
      mark("fixed", "INCORRECT", 1), mark("fixed", "CORRECT", 2),
      mark("still", "PARTLY", 3), mark("still", "SKIPPED", 4),
      mark("never", "CORRECT", 5),
    ]);
    expect(list.map((q) => q.questionId)).toEqual(["still", "fixed"]);
    expect(list[0]).toMatchObject({ tries: 2, misses: 2, still: true, latest: "SKIPPED", history: [true, true] });
    expect(list[1]).toMatchObject({ still: false, history: [true, false], lastWrong: { verdict: "INCORRECT" } });
  });
});

describe("classQuestionMap", () => {
  it("counts students, not tries, and hides the percentage below 3 students", () => {
    const rows = classQuestionMap([
      [mark("q1", "INCORRECT", 1), mark("q1", "INCORRECT", 2)],
      [mark("q1", "INCORRECT", 1), mark("q1", "CORRECT", 2)],
      [mark("q1", "CORRECT", 1), mark("q2", "PARTLY", 1)],
    ]);
    expect(rows[0]).toMatchObject({ questionId: "q1", answered: 3, missed: 2, still: 1, fixed: 1, tries: 5, percent: 67 });
    expect(rows[1]).toMatchObject({ questionId: "q2", answered: 1, missed: 1, percent: null });
    expect(classQuestionSentence(rows[0])).toBe("2 of 3 students (67%) missed it · 1 still does");
    expect(classQuestionSentence(rows[1])).toBe("1 of 1 student missed it · 1 still does");
  });
  it("leaves out questions nobody missed", () => {
    expect(classQuestionMap([[mark("q1", "CORRECT", 1)]])).toEqual([]);
  });
});
