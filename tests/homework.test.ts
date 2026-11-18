import { describe, expect, it } from "vitest";
import { buildMarkPrompt, buildSheetPrompt, parentNote, parseMarks, parseSheet, totalOf } from "@/lib/homework";
import { StudyOutputError } from "@/lib/study-schema";

const qs = [{ q: "What is friction?", marks: 2, answer: "A force that opposes motion." }, { q: "Give an example.", marks: 1, answer: "Brakes." }];

describe("homework sheets", () => {
  it("keeps marks 1–10, drops broken questions, and needs at least two", () => {
    const s = parseSheet(JSON.stringify({ title: "Forces", questions: [{ q: "Define force.", marks: 99, answer: "A push or pull" }, { q: "", marks: 1, answer: "" }, { q: "Name a contact force.", marks: 0, answer: "Friction" }] }), 8);
    expect(s.questions.map((q) => q.marks)).toEqual([10, 1]);
    expect(() => parseSheet(JSON.stringify({ title: "x", questions: [{ q: "Only one?", marks: 1, answer: "" }] }), 8)).toThrow(StudyOutputError);
  });
  it("sends the chapter and notes, without contact details", () => {
    const p = buildSheetPrompt({ grade: "8", subject: "Science", chapter: "Forces", notes: "Friction slows things. Call 98765 43210.", count: 5, level: "Easy", note: "Mail me at a@b.com" });
    expect(p.input).toContain("Chapter: Forces");
    expect(p.input).not.toMatch(/98765|a@b\.com/);
  });
});

describe("marking", () => {
  it("matches marks to questions, caps them, rounds to halves, and fills gaps with 0", () => {
    const m = parseMarks(JSON.stringify({ answers: [{ n: 1, awarded: 1.3, comment: "Good" }, { n: 9, awarded: 5, comment: "?" }], feedback: "Well done.", weak: ["Examples"] }), qs);
    expect(m.answers).toEqual([{ awarded: 1.5, of: 2, comment: "Good" }, { awarded: 0, of: 1, comment: "Not marked." }]);
    expect(totalOf(m)).toBe(1.5);
  });
  it("sends answers without contact details, or says the answers are in the photo", () => {
    expect(buildMarkPrompt({ grade: "8", questions: qs, answers: ["It slows things. 98765 43210", ""] }).input).not.toContain("98765");
    expect(buildMarkPrompt({ grade: "8", questions: qs, answers: null }).input).toContain("attached photo");
  });
  it("writes a parent note with recent results and topics to revise", () => {
    const n = parentNote({ student: "Asha", className: "8-A", teacher: "Ms Iyer", results: [{ title: "Forces", total: 7, outOf: 10 }], weak: ["Friction"] });
    expect(n).toContain("• Forces: 7 / 10");
    expect(n).toContain("Topics to revise at home: Friction.");
  });
});
