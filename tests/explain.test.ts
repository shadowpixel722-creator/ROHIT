import { describe, expect, it } from "vitest";
import { buildExplainPrompt, lessonText, parseExplanation, textHash } from "@/lib/explain-schema";
import { findSpans, flatten, normalise } from "@/lib/highlight";
import { StudyOutputError } from "@/lib/study-schema";

const notes = "## Elements\n- An **element** is a pure substance made of only one kind of atom.\n- Mixtures can be separated by physical methods like filtration.";

describe("parseExplanation", () => {
  const reply = (over: object = {}) => JSON.stringify({
    summary: "This lesson is about elements and mixtures and how to tell them apart.",
    keyPoints: ["An element has one kind of atom"],
    highlights: ["pure substance made of only one kind of atom", "Filtration", "a phrase the student never wrote"],
    sections: [{ heading: "Elements", explanation: "An element is made of just one kind of atom, like pure gold." }],
    ...over,
  });

  it("keeps only highlights that really appear in the notes (ignoring case and Markdown)", () => {
    const e = parseExplanation(reply(), notes);
    expect(e.highlights).toEqual(["pure substance made of only one kind of atom", "Filtration"]);
    expect(e.sections[0].heading).toBe("Elements");
  });

  it("removes contact details and refuses a reply without a summary", () => {
    expect(parseExplanation(reply({ summary: "Call 98765 43210 to learn about elements and mixtures today." }), notes).summary).toContain("[removed]");
    expect(() => parseExplanation(reply({ summary: "" }), notes)).toThrow(StudyOutputError);
    expect(() => parseExplanation("nope", notes)).toThrow(StudyOutputError);
  });
});

describe("lesson text", () => {
  it("joins typed notes and page text in order, and its hash changes when the text does", () => {
    const t = lessonText({ text: "Typed", images: [{ transcript: "Page 1" }, { transcript: null }, { transcript: "Page 3" }] });
    expect(t).toBe("Typed\n\nPage 1\n\nPage 3");
    expect(textHash(t)).toBe(textHash(t));
    expect(textHash(t)).not.toBe(textHash(t + "!"));
  });

  it("prompt carries the notes without contact details", () => {
    const p = buildExplainPrompt({ grade: "8", subject: "Science", chapter: "Matter", title: "Ravi's notes 98765 43210", text: notes + "\nravi@example.com" });
    expect(p.input).toContain("pure substance");
    expect(p.input).not.toMatch(/98765|ravi@example/);
    expect(p.instructions).toMatch(/same order/);
  });
});

describe("finding phrases in rendered notes", () => {
  it("normalises case, spacing and Markdown", () => {
    expect(normalise("  A **Pure**   substance ")).toBe("a pure substance");
    expect(flatten(["a  b", "\n c"]).flat).toBe("a b c");
  });

  it("finds a phrase that spans several text nodes (e.g. bold then plain text)", () => {
    const pieces = ["An ", "element", " is a pure substance made of only one kind of atom."];
    const spans = findSpans(pieces, ["element is a pure substance"]);
    expect(spans).toEqual([{ start: { piece: 1, offset: 0 }, end: { piece: 2, offset: 20 } }]);
  });

  it("finds every occurrence, and ignores very short or missing phrases", () => {
    expect(findSpans(["atom and atom"], ["Atom"]).length).toBe(2);
    expect(findSpans(["atom"], ["at", "molecule"]).length).toBe(0);
  });
});
