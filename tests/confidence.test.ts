import { describe, expect, it } from "vitest";
import { calibration, calibrationAdvice, topicSentence, topicStats, type Answered, type Confidence } from "@/lib/confidence";
import { classMap, profile, trapConfidenceNote, type Chance } from "@/lib/mistakes";
import { classQuestionMap, marksFromAttempts, studentQuestionMistakes } from "@/lib/quiz-mistakes";
import { buildGraph, HEIGHT, neighbours, WIDTH } from "@/lib/topic-graph";

const a = (correct: boolean, confidence: Confidence | null = null): Answered => ({ correct, confidence });
const chance = (fell: boolean, at: number, confidence: Confidence | null = null, m = "m1"): Chance => ({ misconceptionId: m, fell, at, chapter: "Motion", subject: "Science", confidence });

describe("calibration", () => {
  it("counts right answers at each confidence level and ignores unrated ones", () => {
    const c = calibration([a(true, "SURE"), a(false, "SURE"), a(true, "GUESS"), a(true, null)]);
    expect(c.SURE).toEqual({ total: 2, right: 1 });
    expect(c.GUESS).toEqual({ total: 1, right: 1 });
    expect(c.rated).toBe(3);
  });

  it("gives advice only with enough answers, and flags being sure but wrong", () => {
    expect(calibrationAdvice(calibration([a(true, "SURE")]))).toBeNull();
    const over = calibrationAdvice(calibration([a(false, "SURE"), a(false, "SURE"), a(true, "SURE"), a(true, "GUESS"), a(false, "GUESS")]))!;
    expect(over.headline).toContain("When you're sure, you're right 33% of the time.");
    expect(over.tip).toContain("sure but wrong 2 times");
    const under = calibrationAdvice(calibration([a(true, "GUESS"), a(true, "GUESS"), a(true, "UNSURE"), a(true, "SURE"), a(false, "SURE")]))!;
    expect(under.tip).toContain("know more than you think");
  });
});

describe("topic status", () => {
  it("is not started without answers, needs work with an active trap or being sure but wrong", () => {
    expect(topicStats([]).status).toBe("NOT_STARTED");
    expect(topicStats([a(true), a(true), a(true), a(true), a(true)], [{ status: "ACTIVE" }]).status).toBe("NEEDS_WORK");
    expect(topicStats([a(false, "SURE"), a(false, "SURE"), a(true), a(true), a(true), a(true), a(true), a(true), a(true), a(true)]).status).toBe("NEEDS_WORK");
  });

  it("is shaky when right answers were mostly guesses, strong when right and sure", () => {
    const shaky = topicStats([a(true, "GUESS"), a(true, "GUESS"), a(true, "SURE"), a(true, "SURE"), a(true, "SURE")]);
    expect(shaky.status).toBe("SHAKY");
    expect(shaky.shakyRight).toBe(2);
    expect(topicStats([a(true, "SURE"), a(true, "SURE"), a(true, "UNSURE"), a(true, "SURE")]).status).toBe("STRONG");
    expect(topicSentence(shaky)).toBe("5 of 5 right recently · 2 right but not sure");
  });

  it("judges only the most recent 10 answers", () => {
    const old = Array.from({ length: 10 }, () => a(false));
    expect(topicStats([...old, ...Array.from({ length: 10 }, () => a(true, "SURE"))]).status).toBe("STRONG");
  });
});

describe("traps with confidence", () => {
  it("counts falls made while sure, and a guessed avoid doesn't move a trap towards fixed", () => {
    const [t] = profile([chance(true, 1, "SURE"), chance(false, 2, "GUESS"), chance(false, 3, "GUESS"), chance(false, 4, "GUESS")]);
    expect(t.sureFalls).toBe(1);
    expect(t.luckyAvoids).toBe(3);
    expect(t.status).toBe("ACTIVE"); // three lucky guesses since the fall don't count
    expect(trapConfidenceNote(t)).toContain("You were sure the time you fell for it");
    const [u] = profile([chance(true, 1, "SURE"), chance(false, 2, "SURE"), chance(false, 3, "UNSURE"), chance(false, 4, null)]);
    expect(u.status).toBe("FIXED"); // real avoids (and old unrated ones) still count
  });

  it("puts traps fallen for while sure first among active ones, and the class map counts them", () => {
    const list = profile([chance(true, 1, "UNSURE", "slip"), chance(true, 2, "SURE", "belief"), chance(false, 3, "SURE", "slip"), chance(true, 4, "UNSURE", "slip")]);
    expect(list.map((t) => t.misconceptionId)).toEqual(["belief", "slip"]);
    expect(classMap([list, profile([chance(true, 1, "GUESS", "belief")])]).find((c) => c.misconceptionId === "belief")!.sureFell).toBe(1);
  });
});

describe("written quizzes with confidence", () => {
  const attempt = (items: string[], verdicts: string[], confidence: unknown) => ({
    items: JSON.stringify(items), answers: JSON.stringify(items.map((i) => `answer ${i}`)), submittedAt: new Date(1000),
    grades: JSON.stringify(verdicts.map((verdict) => ({ verdict, feedback: "" }))), confidence: JSON.stringify(confidence),
  });

  it("reads each answer's confidence, ignoring lists that don't line up", () => {
    expect(marksFromAttempts([attempt(["q1", "q2"], ["CORRECT", "INCORRECT"], ["GUESS", "SURE"])]).map((m) => m.confidence)).toEqual(["GUESS", "SURE"]);
    expect(marksFromAttempts([attempt(["q1", "q2"], ["CORRECT", "INCORRECT"], ["SURE"])]).map((m) => m.confidence)).toEqual([null, null]);
    expect(marksFromAttempts([{ ...attempt(["q1"], ["CORRECT"], []), confidence: null }])[0].confidence).toBeNull();
  });

  it("marks questions missed while sure, for the student and (as a count) for the class", () => {
    const marks = marksFromAttempts([attempt(["q1", "q2"], ["INCORRECT", "PARTLY"], ["SURE", "GUESS"])]);
    const mine = studentQuestionMistakes(marks);
    expect(mine[0]).toMatchObject({ questionId: "q1", sureMisses: 1, lastWrong: { confidence: "SURE" } });
    expect(classQuestionMap([marks]).find((q) => q.questionId === "q1")!.sureMissed).toBe(1);
  });
});

describe("topic map", () => {
  const input = {
    subjects: [{ id: "sci", name: "Science", color: "#2f6f68" }, { id: "math", name: "Maths", color: "#2a78d6" }],
    chapters: [
      { id: "c1", name: "1. Motion", position: 1, subjectId: "sci" },
      { id: "c2", name: "2. Force", position: 2, subjectId: "sci" },
      { id: "c3", name: "3. Sound", position: 3, subjectId: "sci" },
      { id: "c4", name: "Fractions", position: 1, subjectId: "math" },
    ],
    answers: new Map([["c1", [a(false, "SURE"), a(false, "SURE")]], ["c2", [a(true, "SURE")]]]),
    traps: [{ id: "speed", label: "Mixes up speed and velocity", status: "ACTIVE" as const, sureFalls: 2, falls: 2, chances: 3, chapterIds: ["c1", "c2"] }],
  };

  it("makes a node per subject, topic and trap, and a trap met in two topics joins both", () => {
    const g = buildGraph(input);
    expect(g.nodes.filter((n) => n.kind === "subject")).toHaveLength(2);
    expect(g.nodes.filter((n) => n.kind === "topic")).toHaveLength(4);
    expect(g.nodes.filter((n) => n.kind === "trap")).toHaveLength(1);
    expect(g.edges.filter((e) => e.kind === "trap").map((e) => e.from).sort()).toEqual(["c:c1", "c:c2"]);
    expect([...neighbours(g, "m:speed")].sort()).toEqual(["c:c1", "c:c2", "m:speed"]);
    const status = Object.fromEntries(g.nodes.flatMap((n) => (n.kind === "topic" ? [[n.chapterId, n.status]] : [])));
    expect(status).toEqual({ c1: "NEEDS_WORK", c2: "NEEDS_WORK", c3: "NOT_STARTED", c4: "NOT_STARTED" }); // c2 has the active trap
    expect(g.nodes.find((n) => n.id === "c:c1")!.label).toBe("Motion");
  });

  it("lays nodes out inside the drawing, apart from each other, the same way every time", () => {
    const g = buildGraph(input);
    for (const n of g.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(WIDTH);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(g.height);
      expect(g.height).toBeLessThanOrEqual(HEIGHT);
    }
    for (const [i, p] of g.nodes.entries()) for (const q of g.nodes.slice(i + 1)) expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(p.r + q.r);
    expect(buildGraph(input).nodes.map((n) => [n.x, n.y])).toEqual(g.nodes.map((n) => [n.x, n.y]));
  });

  it("adds written answers still to fix as nodes joined to their topic (at most 3 per topic)", () => {
    const missed = ["a", "b", "c", "d"].map((id) => ({ id, question: `Question ${id}?`, chapterId: "c1", sure: id === "a" }));
    const g = buildGraph({ ...input, missed: [...missed, { id: "x", question: "Gone?", chapterId: "nope", sure: false }] });
    const w = g.nodes.filter((n) => n.kind === "written");
    expect(w).toHaveLength(3);
    expect(g.edges.filter((e) => e.kind === "written").every((e) => e.from === "c:c1")).toBe(true);
    expect(w[0]).toMatchObject({ label: "Question a?", sure: true });
  });

  it("leaves out subjects with no topics", () => {
    expect(buildGraph({ ...input, chapters: input.chapters.filter((c) => c.subjectId === "sci") }).nodes.some((n) => n.id === "s:math")).toBe(false);
  });
});
