import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonth } from "@/lib/assessments";
import { assessmentReadiness, isBlank, levelOf, mastery, MAX_ANSWER_CHARS, noteBreakdown, pickQuestions, pointsOf, quizSize, shuffle } from "@/lib/quiz";

/** Small deterministic random source so the tests never flake. */
function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe("shuffle", () => {
  it("keeps every item exactly once and doesn't change the input", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffle(input, seeded());
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("quizSize", () => {
  it("is 2 per note, between 4 and 10 (written answers take longer)", () => {
    expect([1, 2, 3, 5, 9].map(quizSize)).toEqual([4, 4, 6, 10, 10]);
  });
});

describe("pickQuestions", () => {
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, noteId: "A" })),
    ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, noteId: "B" })),
    { id: "c0", noteId: "C" },
  ];

  it("spreads questions across every studied note and never repeats one", () => {
    const picked = pickQuestions(pool, new Set(), 6, seeded());
    expect(new Set(picked).size).toBe(6);
    const notes = new Set(picked.map((id) => pool.find((q) => q.id === id)!.noteId));
    expect(notes).toEqual(new Set(["A", "B", "C"]));
  });

  it("asks unseen questions before ones the student has already had", () => {
    const seen = new Set(["a0", "a1", "a2", "b0", "b1", "b2"]);
    const picked = pickQuestions(pool, seen, 6, seeded());
    expect(picked.filter((id) => seen.has(id))).toEqual([]);
  });

  it("falls back to seen questions when the notes have no fresh ones left, and never exceeds the pool", () => {
    const seen = new Set(pool.map((q) => q.id));
    expect(pickQuestions(pool, seen, 5, seeded())).toHaveLength(5);
    expect(pickQuestions(pool.slice(0, 2), new Set(), 15, seeded())).toHaveLength(2);
  });
});

describe("marking written answers", () => {
  it("gives a full mark for correct, half for partly correct, none for the rest", () => {
    expect(pointsOf([{ verdict: "CORRECT", feedback: "" }, { verdict: "PARTLY", feedback: "" }, { verdict: "INCORRECT", feedback: "" }, { verdict: "SKIPPED", feedback: "" }])).toBe(1.5);
    expect(pointsOf([])).toBe(0);
  });

  it("treats empty and one-letter answers as blank, so they are never sent to the AI", () => {
    expect(["", "  ", "\n", "a"].map(isBlank)).toEqual([true, true, true, true]);
    expect(isBlank("It is a fossil fuel")).toBe(false);
    expect(MAX_ANSWER_CHARS).toBeGreaterThan(200);
  });

  it("breaks results down by note, in points", () => {
    const grades = [{ verdict: "CORRECT" as const, feedback: "" }, { verdict: "PARTLY" as const, feedback: "" }, { verdict: "INCORRECT" as const, feedback: "" }];
    const b = noteBreakdown(["q1", "q2", "q3"], grades, new Map([["q1", "A"], ["q2", "A"], ["q3", "B"]]));
    expect(b.get("A")).toEqual({ points: 1.5, total: 2 });
    expect(b.get("B")).toEqual({ points: 0, total: 1 });
  });
});

describe("readiness", () => {
  it("averages the last three quizzes, newest first", () => {
    expect(mastery([])).toBeNull();
    expect(mastery([{ score: 5, total: 5 }])).toBe(100);
    expect(mastery([{ score: 2.5, total: 5 }])).toBe(50); // half marks count
    expect(mastery([{ score: 4, total: 5 }, { score: 2, total: 5 }, { score: 3, total: 5 }, { score: 0, total: 5 }])).toBe(60); // the oldest is ignored
  });

  it("labels levels", () => {
    expect([null, 10, 50, 79, 80].map(levelOf)).toEqual(["NOT_STARTED", "NEEDS_WORK", "ALMOST", "ALMOST", "READY"]);
  });

  it("counts a chapter with no quiz yet as zero for a test, and says 'not started' when none has one", () => {
    expect(assessmentReadiness([])).toEqual({ percent: null, level: "NOT_STARTED" });
    expect(assessmentReadiness([null, null])).toEqual({ percent: null, level: "NOT_STARTED" });
    expect(assessmentReadiness([100, null])).toEqual({ percent: 50, level: "ALMOST" });
    expect(assessmentReadiness([90, 80])).toEqual({ percent: 85, level: "READY" });
  });
});

describe("calendar grid", () => {
  it("starts on Monday and holds every day of the month", () => {
    const weeks = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(weeks[0][0].key).toBe("2026-10-26");
    expect(weeks[0][6]).toEqual({ key: "2026-11-01", inMonth: true });
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(30);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("moves between months across a year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
