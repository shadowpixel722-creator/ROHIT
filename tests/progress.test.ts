import { describe, expect, it } from "vitest";
import { groupAverage, overall, summariseSubject } from "@/lib/progress";

const ch = (id: string, ready: boolean, percent: number | null) => ({ id, name: `Chapter ${id}`, ready, percent });

describe("summariseSubject", () => {
  it("counts only chapters with published material", () => {
    const s = summariseSubject([ch("1", true, 80), ch("2", true, null), ch("3", false, null)]);
    expect(s).toMatchObject({ ready: 2, practised: 1, average: 80 });
  });

  it("suggests a chapter not yet tried first, then the weakest one below 80%", () => {
    expect(summariseSubject([ch("1", true, 40), ch("2", true, null)]).weakest?.id).toBe("2");
    expect(summariseSubject([ch("1", true, 90), ch("2", true, 55), ch("3", true, 70)]).weakest?.id).toBe("2");
    expect(summariseSubject([ch("1", true, 90), ch("2", true, 85)]).weakest).toBeNull(); // all ready
  });

  it("has no average before any quiz", () => {
    expect(summariseSubject([ch("1", true, null)]).average).toBeNull();
  });
});

describe("overall", () => {
  it("weights the average by chapters practised", () => {
    const a = summariseSubject([ch("1", true, 100)]);
    const b = summariseSubject([ch("2", true, 40), ch("3", true, 40), ch("4", true, 40)]);
    expect(overall([a, b])).toEqual({ ready: 4, practised: 4, average: 55 });
    expect(overall([])).toEqual({ ready: 0, practised: 0, average: null });
  });
});

describe("groupAverage", () => {
  it("hides class averages for fewer than 3 students, so nobody can be singled out", () => {
    expect(groupAverage([90, 10])).toBeNull();
    expect(groupAverage([90, 60, 30])).toBe(60);
  });
});

import { byWeek, recentWeeks, weekStart } from "@/lib/progress";

describe("weeks", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-12")).toBe("2026-11-09"); // Thursday -> Monday
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sunday belongs to the week before it
  });

  it("lists recent weeks oldest first, across a month boundary", () => {
    expect(recentWeeks("2026-11-12", 3)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
  });

  it("groups items into those weeks and ignores older ones", () => {
    const g = byWeek([{ day: "2026-11-10", item: 1 }, { day: "2026-11-03", item: 2 }, { day: "2026-01-01", item: 3 }], recentWeeks("2026-11-12", 2));
    expect(g.get("2026-11-09")).toEqual([1]);
    expect(g.get("2026-11-02")).toEqual([2]);
  });
});
