import { describe, expect, it } from "vitest";
import { planFor, planView } from "@/lib/plan";

const ch = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Chapter ${i + 1}` }));

describe("study plan", () => {
  it("spreads chapters over the days, then revision, ending the day before the exam", () => {
    const p = planFor({ id: "a", date: "2026-11-30", start: "2026-11-20", chapters: ch(4) });
    // 10 days (20th–29th): 8 study days, 2 revision days
    expect(p.filter((t) => t.kind === "study").map((t) => t.day)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]);
    expect(p.filter((t) => t.kind !== "study").map((t) => [t.kind, t.day])).toEqual([["revise", "2026-11-28"], ["check", "2026-11-29"]]);
    expect(new Set(p.map((t) => t.key)).size).toBe(p.length);
  });

  it("doubles up chapters when there are few days, and always ends with a check", () => {
    const p = planFor({ id: "a", date: "2026-11-23", start: "2026-11-21", chapters: ch(3) });
    expect(p.filter((t) => t.kind === "study").map((t) => t.day)).toEqual(["2026-11-21", "2026-11-21", "2026-11-22"]);
    expect(p.at(-1)).toMatchObject({ kind: "check", day: "2026-11-22" });
  });

  it("is the same every time, and shows missed tasks to catch up", () => {
    const a = { id: "a", date: "2026-11-30", start: "2026-11-20", chapters: ch(4) };
    expect(planFor(a)).toEqual(planFor(a));
    const v = planView(planFor(a), new Set(["a:cc1"]), "2026-11-22");
    expect(v.catchUp.map((t) => t.key)).toEqual(["a:cc2"]);
    expect(v.today.map((t) => t.key)).toEqual(["a:cc3"]);
    expect(v.week[0]).toMatchObject({ day: "2026-11-23" });
  });
});
