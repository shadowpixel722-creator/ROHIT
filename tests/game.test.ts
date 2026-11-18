import { describe, expect, it } from "vitest";
import { battleReward, catchUp, cleanLook, damageOf, hitDay, levelOf, questionTier, replayBattle, streakDays, tierOf, type StreakState } from "@/lib/game";

const fresh = (o: Partial<StreakState> = {}): StreakState => ({ streak: 0, best: 0, lastDay: null, freezes: 0, days: {}, ...o });

describe("streak", () => {
  it("starts, grows once a day, and doesn't double count the same day", () => {
    let s = hitDay(fresh(), "2026-11-10");
    expect(s).toMatchObject({ streak: 1, first: true });
    const again = hitDay(s, "2026-11-10");
    expect(again).toMatchObject({ streak: 1, first: false });
    s = hitDay(s, "2026-11-11");
    expect(s.streak).toBe(2);
    expect(s.days).toEqual({ "2026-11-10": "on", "2026-11-11": "on" });
  });

  it("earns a freeze every 7 days (holding at most 2) and freezes cover missed days", () => {
    let s: StreakState = fresh();
    for (let d = 1; d <= 7; d++) s = hitDay(s, `2026-11-0${d}`.replace(/-0(\d\d)$/, "-$1"));
    expect(s.streak).toBe(7);
    expect(s.freezes).toBe(1);
    const later = catchUp(s, "2026-11-09"); // missed 8 Nov
    expect(later).toMatchObject({ used: 1, freezes: 0, streak: 7, lastDay: "2026-11-08" });
    expect(later.days["2026-11-08"]).toBe("ice");
    expect(hitDay(s, "2026-11-09").streak).toBe(8);
  });

  it("ends when more days are missed than freezes cover", () => {
    const s = fresh({ streak: 5, best: 5, lastDay: "2026-11-01", freezes: 1 });
    expect(catchUp(s, "2026-11-05")).toMatchObject({ streak: 0, lost: 5 });
    expect(hitDay(s, "2026-11-05")).toMatchObject({ streak: 1, best: 5 });
  });

  it("shows the last two weeks", () => {
    const days = streakDays(fresh({ days: { "2026-11-17": "on", "2026-11-16": "ice" } }), "2026-11-18");
    expect(days).toHaveLength(14);
    expect(days.slice(-3).map((d) => d.state)).toEqual(["ice", "on", "today"]);
  });
});

describe("levels", () => {
  it("needs 100 more XP for each level", () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelOf(150)).toEqual({ level: 2, into: 50, need: 200 });
    expect(levelOf(300).level).toBe(3);
  });
});

describe("boss battles", () => {
  it("more energy means a harder question and a bigger hit, with a combo bonus", () => {
    expect([1, 3, 4, 6, 7, 10].map(tierOf)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(damageOf(5, 0)).toBe(50);
    expect(damageOf(5, 2)).toBe(60);
    expect(damageOf(5, 9)).toBe(75); // combo bonus capped at +50%
  });

  it("replays a battle from its answers, so the server decides who won", () => {
    const win = replayBattle([{ energy: 10, correct: true }, { energy: 10, correct: true }, { energy: 10, correct: true }], 300);
    expect(win).toMatchObject({ won: true, right: 3, damage: 100 + 110 + 120 - 0 });
    const lose = replayBattle(Array.from({ length: 5 }, () => ({ energy: 10, correct: false })), 300);
    expect(lose).toMatchObject({ lost: true, heroHp: 0, turns: 3 });
    // answers after the battle ended don't count
    expect(replayBattle([{ energy: 10, correct: true }, { energy: 10, correct: true }], 50).turns).toBe(1);
    // a partly-correct written answer: half the damage, the combo is kept but doesn't grow
    expect(replayBattle([{ energy: 5, correct: true }, { energy: 5, correct: false, score: 0.5 }, { energy: 5, correct: true }], 999)).toMatchObject({ damage: 50 + 28 + 55, right: 2, heroHp: 100 });
    // parries (energy 0): a block does nothing, a miss costs 15 HP; neither is a turn
    expect(replayBattle([{ energy: 0, correct: true }, { energy: 0, correct: false }], 300)).toMatchObject({ heroHp: 85, turns: 0, damage: 0 });
  });

  it("rewards and difficulty", () => {
    expect(battleReward({ won: true, right: 4, damage: 300 })).toEqual({ coins: 30 + 8 + 30, xp: 48 });
    expect(battleReward({ won: false, right: 1, damage: 50 })).toEqual({ coins: 7, xp: 10 });
    expect(questionTier(1, 0)).toBe(2);
    expect(questionTier(10, 9)).toBe(1);
    expect(questionTier(10, 3)).toBe(3);
  });
});

describe("shop", () => {
  it("only lets you wear things you own (free items are always yours)", () => {
    expect(cleanLook({ armor: "gold", hat: "crown", sword: "nope" }, ["hat:crown"])).toEqual({ armor: "blue", hat: "crown", sword: "steel", cape: "none", aura: "none" });
  });
});
