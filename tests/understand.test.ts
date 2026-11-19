import { describe, expect, it } from "vitest";
import { StudyOutputError } from "@/lib/study-schema";
import { buildUnderstandPrompt, excerpt, parseUnderstand, type UnderstandItem } from "@/lib/understand";

const mcq = (answered: boolean): UnderstandItem => ({ kind: "mcq", title: "Friction", content: "What slows a rolling ball?\nA) Gravity\nB) Friction", answered, ...(answered ? { answer: "B) Friction. It acts against motion." } : {}) });

describe("buildUnderstandPrompt", () => {
  it("never sends the answer of an unanswered question, and says not to give it", () => {
    const { instructions, input } = buildUnderstandPrompt({ grade: "8", subject: "Science", item: mcq(false), notes: [] });
    expect(input).not.toContain("It acts against motion");
    expect(input).not.toContain("The right answer");
    expect(input).toContain("has NOT answered it yet");
    expect(instructions).toMatch(/Never give the answer/);
  });
  it("includes the right answer once answered", () => {
    const { input } = buildUnderstandPrompt({ grade: "8", subject: "Science", item: mcq(true), notes: [] });
    expect(input).toContain("The right answer");
    expect(input).toContain("It acts against motion");
  });
  it("removes contact details and sends no name or ids", () => {
    const item: UnderstandItem = { kind: "explanation", title: "Magnets", content: "Like poles repel. Call 98765 43210 or mail a@b.com.", answered: false };
    const { input } = buildUnderstandPrompt({ grade: null, subject: null, item, notes: [{ title: "Magnets", chapter: "Exploring Magnets", text: "Opposite poles attract." }] });
    expect(input).not.toContain("98765");
    expect(input).not.toContain("a@b.com");
    expect(input).toContain("Opposite poles attract.");
    expect(input).not.toMatch(/has NOT answered|has already answered/); // not a question
  });
});

describe("parseUnderstand", () => {
  it("cleans the reply and keeps at most 4 words", () => {
    const r = parseUnderstand(JSON.stringify({ explanation: "**Friction** slows things.", words: Array.from({ length: 6 }, (_, i) => ({ word: `w${i}`, meaning: "m" })).concat([{ word: "", meaning: "x" }]) }));
    expect(r.explanation).toBe("Friction slows things.");
    expect(r.words).toHaveLength(4);
  });
  it("rejects an empty or broken reply", () => {
    expect(() => parseUnderstand(JSON.stringify({ explanation: "", words: [] }))).toThrow(StudyOutputError);
    expect(() => parseUnderstand("nope")).toThrow(StudyOutputError);
  });
});

describe("excerpt", () => {
  it("cuts at a sentence end and removes contact details", () => {
    const text = `${"Plants make food. ".repeat(50)}Call 98765 43210.`;
    const e = excerpt(text, 100);
    expect(e.length).toBeLessThanOrEqual(101);
    expect(e.endsWith(".…")).toBe(true);
    expect(excerpt("Short note. Phone 98765 43210")).not.toContain("98765");
  });
});
