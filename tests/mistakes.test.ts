import { describe, expect, it } from "vitest";
import { buildMcqPrompt, parseMcqOutput } from "@/lib/mcq-schema";
import { classMap, classTrapSentence, madeMistakes, pickForTrap, profile, statusOf, trapProgress, trapSentence, type Chance } from "@/lib/mistakes";
import { StudyOutputError } from "@/lib/study-schema";

describe("trap status", () => {
  it("is clear, active, fading or fixed from the sequence of chances", () => {
    expect(statusOf([])).toBe("CLEAR");
    expect(statusOf([false, false])).toBe("CLEAR");
    expect(statusOf([false, true])).toBe("ACTIVE");      // fell last time
    expect(statusOf([true, true, false])).toBe("FADING"); // avoided once since
    expect(statusOf([true, false, false])).toBe("FADING");
    expect(statusOf([true, false, false, false])).toBe("FIXED"); // 3 in a row since the last fall
    expect(statusOf([true, false, false, false, true])).toBe("ACTIVE"); // came back
  });
});

const chance = (m: string, fell: boolean, at: number, chapter = "Motion"): Chance => ({ misconceptionId: m, fell, at, chapter, subject: "Science" });

describe("profile", () => {
  const p = profile([
    // "distance vs displacement": fell 6 of 8, most recently fell
    ...[true, true, false, true, true, false, true, true].map((f, i) => chance("dist", f, i)),
    // "speed vs velocity": fell twice, then avoided 3 times
    ...[true, true, false, false, false].map((f, i) => chance("speed", f, 100 + i)),
    // "mass vs weight": never fell
    chance("mass", false, 200, "Force"),
    chance("mass", false, 201, "Gravitation"),
  ]);

  it("counts falls and chances, and sorts active traps first", () => {
    expect(p.map((t) => [t.misconceptionId, t.status])).toEqual([["dist", "ACTIVE"], ["speed", "FIXED"], ["mass", "CLEAR"]]);
    expect(p[0]).toMatchObject({ falls: 6, chances: 8, scope: "Motion" });
    expect(p[2].scope).toBe("Science"); // chances span chapters, so the subject is named
  });

  it("writes the sentences students see", () => {
    expect(trapSentence("distance instead of displacement", p[0])).toBe("You pick the “distance instead of displacement” trap in 6 of 8 Motion questions.");
    expect(trapProgress(p[0])).toMatch(/fell for it last time/);
    expect(trapSentence("x", { falls: 1, chances: 1, scope: "5. Exploring Forces" })).toBe("You pick the “x” trap in 1 of 1 Exploring Forces question.");
    expect(trapProgress({ status: "FADING", avoidedSince: 1 })).toBe("Avoided it 1 time in a row. 2 more to fix it.");
    expect(trapProgress(p[1])).toMatch(/3 times in a row/);
  });
});

describe("class map: only mistakes actually made", () => {
  const student = (seq: boolean[], m = "dist") => profile(seq.map((f, i) => chance(m, f, i)));

  it("counts students who met a trap, fell for it, still do, and fixed it", () => {
    const map = classMap([student([true, true]), student([false, true]), student([false, false]), student([true, false, false, false])]);
    expect(map[0]).toMatchObject({ misconceptionId: "dist", met: 4, fell: 3, active: 2, fixed: 1, falls: 4, percent: 75 });
    expect(classTrapSentence(map[0])).toBe("3 of 4 students (75%) fell for it · 2 still do");
  });

  it("leaves out traps nobody has fallen for", () => {
    const map = classMap([student([false, false], "never"), student([true], "dist")]);
    expect(map.map((m) => m.misconceptionId)).toEqual(["dist"]);
  });

  it("shows counts but hides the percentage when fewer than 3 students met the trap", () => {
    const c = classMap([student([true]), student([false, false, false, true])])[0];
    expect(c.percent).toBeNull();
    expect(classTrapSentence(c)).toBe("2 of 2 students fell for it · 2 still do");
  });

  it("madeMistakes keeps only traps a student fell for", () => {
    const p = profile([chance("a", false, 1), chance("b", true, 2), chance("b", false, 3)]);
    expect(madeMistakes(p).map((t) => t.misconceptionId)).toEqual(["b"]);
  });
});

describe("picking questions for a trap", () => {
  it("serves unseen questions first, then ones the student fell for", () => {
    const history = new Map<string, "fell" | "avoided">([["a", "avoided"], ["b", "fell"]]);
    expect(pickForTrap([{ id: "a" }, { id: "b" }, { id: "c" }], history, 2)).toEqual(["c", "b"]);
  });
});

describe("AI questions with tagged wrong options", () => {
  const q = (over: object = {}) => ({
    stem: "A runner goes once round a 400 m track. What is her displacement?",
    choices: [
      { text: "400 m", misconception: "Confuses distance with displacement" },
      { text: "0 m", misconception: "" },
      { text: "200 m", misconception: "Thinks displacement is half the distance" },
      { text: "800 m", misconception: "" },
    ],
    answerIndex: 1,
    explanation: "She ends where she started, so displacement is zero.",
    ...over,
  });

  it("links each wrong option to a misconception, reusing existing names", () => {
    const out = parseMcqOutput(JSON.stringify({
      misconceptions: [{ label: "Thinks displacement is half the distance", fix: "Displacement is the straight line from start to end." }],
      questions: [q()],
    }), ["Confuses distance with displacement"]);
    expect(out.questions[0].tags).toEqual(["Confuses distance with displacement", null, "Thinks displacement is half the distance", null]);
    expect(out.misconceptions.map((m) => m.label)).toEqual(["Thinks displacement is half the distance"]); // the existing one isn't re-created
  });

  it("drops questions with no tagged wrong option, duplicate choices, or a bad answer index", () => {
    const untagged = q({ choices: q().choices.map((c) => ({ ...c, misconception: "" })) });
    const dupes = q({ choices: [{ text: "0 m" }, { text: "0 m" }, { text: "1 m" }, { text: "2 m" }] });
    const badIndex = q({ answerIndex: 5 });
    expect(() => parseMcqOutput(JSON.stringify({ questions: [untagged, dupes, badIndex] }), ["Confuses distance with displacement"])).toThrow(StudyOutputError);
    expect(parseMcqOutput(JSON.stringify({ questions: [q(), untagged] }), ["Confuses distance with displacement"]).dropped).toBe(1);
  });

  it("ignores a tag that names no known misconception", () => {
    const out = parseMcqOutput(JSON.stringify({ questions: [q()] }), ["Confuses distance with displacement"]);
    expect(out.questions[0].tags[2]).toBeNull(); // "half the distance" wasn't declared
  });

  it("prompt: sends the notes without contact details, lists existing names, and can aim at one trap", () => {
    const p = buildMcqPrompt({ grade: "9", subject: "Science", chapter: "Motion", text: "Displacement is the shortest path. Call 98765 43210.", existing: ["Confuses distance with displacement"], target: { label: "Confuses distance with displacement", fix: "Displacement is start-to-end." } });
    expect(p.input).toContain("- Confuses distance with displacement");
    expect(p.input).toContain("designed to break this misconception");
    expect(p.input).not.toMatch(/98765/);
  });
});
