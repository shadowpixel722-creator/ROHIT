import { describe, expect, it } from "vitest";
import { perfectWritten, rankBoard } from "@/lib/leaderboard";

const p = (id: string, value: number, name = id) => ({ id, name, value });

describe("rankBoard", () => {
  it("ranks highest first, ties share a rank and are listed by name", () => {
    const b = rankBoard("xp", [p("c", 50), p("a", 80), p("d", 50, "Anu"), p("b", 20)], null);
    expect(b.rows.map((r) => [r.rank, r.name, r.value])).toEqual([[1, "a", 80], [2, "Anu", 50], [2, "c", 50], [4, "b", 20]]);
  });
  it("leaves out people with nothing yet", () => {
    expect(rankBoard("xp", [p("a", 0), p("b", 3)], "a")).toEqual({ metric: "xp", rows: [{ rank: 1, name: "b", value: 3, you: false }], you: null });
  });
  it("shows the top rows and the viewer's own rank even below them", () => {
    const people = Array.from({ length: 15 }, (_, i) => p(`u${i}`, 100 - i));
    const b = rankBoard("perfect", people, "u12", 10);
    expect(b.rows).toHaveLength(10);
    expect(b.rows.some((r) => r.you)).toBe(false);
    expect(b.you).toEqual({ rank: 13, value: 88 });
    expect(rankBoard("perfect", people, "u0").rows[0].you).toBe(true);
  });
});

describe("perfectWritten", () => {
  it("counts fully correct written answers only", () => {
    expect(perfectWritten(JSON.stringify([{ verdict: "CORRECT" }, { verdict: "PARTLY" }, { verdict: "CORRECT" }, { verdict: "INCORRECT" }]))).toBe(2);
  });
  it("is 0 for missing or broken grades", () => {
    expect(perfectWritten(null)).toBe(0);
    expect(perfectWritten("not json")).toBe(0);
  });
});
