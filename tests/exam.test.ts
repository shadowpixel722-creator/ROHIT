import { describe, expect, it } from "vitest";
import { buildPatternPrompt, parsePatternOutput, patternSchema, PRESETS, statedTotal, totalMarks, totalQuestions } from "@/lib/exam-schema";
import { StudyOutputError } from "@/lib/study-schema";

const pattern = { sections: [
  { name: "Section A", type: "mcq" as const, count: 2, marks: 1, note: "" },
  { name: "Section B", type: "short" as const, count: 2, marks: 3, note: "40 words" },
] };
describe("presets and totals", () => {
  it("presets are valid and add up to their stated marks", () => {
    for (const p of PRESETS) expect(patternSchema.safeParse(p).success).toBe(true);
    expect(totalMarks(PRESETS[0].sections)).toBe(40);
    expect(totalMarks(PRESETS[1].sections)).toBe(80);
    expect(totalQuestions(PRESETS[1].sections)).toBe(39);
  });

  it("rejects empty or oversized patterns", () => {
    expect(patternSchema.safeParse({ name: "X", durationMinutes: 60, sections: [] }).success).toBe(false);
    expect(patternSchema.safeParse({ name: "X", durationMinutes: 5, sections: pattern.sections }).success).toBe(false);
    expect(patternSchema.safeParse({ name: "X", durationMinutes: 60, sections: [{ ...pattern.sections[0], count: 61 }] }).success).toBe(false);
  });
});

describe("prompts", () => {
  it("reads a pasted pattern into sections", () => {
    expect(buildPatternPrompt("Section A: 20 MCQs of 1 mark").input).toContain("20 MCQs");
    const out = parsePatternOutput(JSON.stringify({ name: "Half-yearly", durationMinutes: 180, instructions: "", sections: [{ name: "Section A", type: "mcq", count: 20, marks: 1, note: "" }] }));
    expect(totalMarks(out.sections)).toBe(20);
    expect(() => parsePatternOutput(JSON.stringify({ name: "X", durationMinutes: 60, sections: [{ name: "A", type: "essay", count: 2, marks: 5 }] }))).toThrow(StudyOutputError);
  });
});

describe("statedTotal", () => {
  it("finds the total a pattern states, not per-question marks", () => {
    expect(statedTotal("Periodic test, 1 hour, 25 marks.\nSection A: 5 MCQs of 1 mark each.")).toBe(25);
    expect(statedTotal("Half-yearly exam\nMaximum marks: 80\nSection C has 7 questions of 3 marks")).toBe(80);
    expect(statedTotal("Unit test\n40 marks in total. Section B: 2 marks each")).toBe(40);
    expect(statedTotal("Section A: 10 questions of 2 marks each")).toBeNull();
  });
});
