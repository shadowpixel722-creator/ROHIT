/**
 * Game rules (ported from Knowa, now kept on the server): the daily streak with Streak Freezes, XP and
 * coins, Boss Battle damage, and the cosmetics shop catalogue. Pure, so it is unit-tested; the database
 * side is in game-server.ts.
 */
import { addDays, daysBetween } from "./dates";

/* ------------------------------------------------------------------ streak */

export const MAX_FREEZES = 2;
/** A Streak Freeze is earned every this many days in a row. */
export const FREEZE_EVERY = 7;
/** Coins for the first learning of each day. */
export const DAILY_COINS = 10;

export type StreakState = { streak: number; best: number; lastDay: string | null; freezes: number; days: Record<string, "on" | "ice"> };

/**
 * Brings a streak up to `today` before anything else happens: missed days are covered by freezes
 * (marked "ice"), or, if there aren't enough, the streak ends. `used` / `lost` say what happened.
 */
export function catchUp(s: StreakState, today: string): StreakState & { used: number; lost: number } {
  if (!s.lastDay || s.lastDay >= today) return { ...s, used: 0, lost: 0 };
  const missed = daysBetween(s.lastDay, today) - 1;
  if (missed < 1) return { ...s, used: 0, lost: 0 };
  if (missed <= s.freezes) {
    const days = { ...s.days };
    for (let i = 1; i <= missed; i++) days[addDays(s.lastDay, i)] = "ice";
    return { ...s, freezes: s.freezes - missed, lastDay: addDays(today, -1), days, used: missed, lost: 0 };
  }
  return { ...s, streak: 0, lastDay: null, used: 0, lost: s.streak };
}

/** Counts learning on `today`: the streak grows once per day, and every FREEZE_EVERY days earns a freeze. */
export function hitDay(s0: StreakState, today: string): StreakState & { first: boolean; earnedFreeze: boolean; used: number; lost: number } {
  const s = catchUp(s0, today);
  if (s.lastDay === today) return { ...s, first: false, earnedFreeze: false };
  const streak = s.lastDay === addDays(today, -1) ? s.streak + 1 : 1;
  const earnedFreeze = streak % FREEZE_EVERY === 0 && s.freezes < MAX_FREEZES;
  const days: Record<string, "on" | "ice"> = { ...s.days, [today]: "on" };
  const cutoff = addDays(today, -70);
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k];
  return { ...s, streak, best: Math.max(s.best, streak), lastDay: today, freezes: s.freezes + (earnedFreeze ? 1 : 0), days, first: true, earnedFreeze };
}

/** The last `n` days for the streak calendar, oldest first. */
export function streakDays(s: StreakState, today: string, n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1);
    return { d, state: s.days[d] ?? (d === today ? "today" : "off") } as { d: string; state: "on" | "ice" | "today" | "off" };
  });
}

/* ------------------------------------------------------------------ XP and levels */

export const XP = { practiceRight: 5, quizPoint: 4, lessonDone: 20, flashcardsDone: 5, bossWin: 40, bossTry: 10 } as const;

/** Level from XP: each level needs 100 more XP than the last (100, 300, 600, …). */
export function levelOf(xp: number) {
  let level = 1, need = 100, floor = 0;
  while (xp >= floor + need) { floor += need; level++; need += 100; }
  return { level, into: xp - floor, need };
}

/* ------------------------------------------------------------------ Boss Battles */

export type Tier = 1 | 2 | 3;
export const tierOf = (energy: number): Tier => (energy <= 3 ? 1 : energy <= 6 ? 2 : 3);
export const TIER_LABEL: Record<Tier, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };
export const HERO_HP = 100;
export const RAID_TURNS = 8;
/** Boss HP by how many approved questions the chapter has (more questions, longer fight). */
export const bossHp = (questions: number) => Math.min(560, 220 + Math.max(0, questions - 6) * 20);
/** Damage of a right answer: energy × 10, +10% per answer in a row (up to +50%). */
export const damageOf = (energy: number, combo: number) => Math.round(energy * 10 * (1 + Math.min(combo, 5) * 0.1));
/** What the boss does to you after a wrong answer. */
export const hitBack = (energy: number) => 10 + energy * 3;
/** Missing a parry (the boss's timed big attack) costs this much. */
export const PARRY_HIT = 15;
/** Seconds to answer a parry. */
export const PARRY_SECONDS = 30;
/** A chapter needs this many approved questions (multiple choice and written together) to have a boss. */
export const MIN_BOSS_QUESTIONS = 5;

/**
 * Replays a battle from its recorded answers (energy and right/wrong, in order) and says how it went. The
 * server uses this for rewards, so the client can't claim a win it didn't earn.
 */
export function replayBattle(answers: { energy: number; correct: boolean; score?: number }[], bossMaxHp: number) {
  let boss = bossMaxHp, hero = HERO_HP, combo = 0, damage = 0, right = 0, turns = 0;
  for (const a of answers) {
    if (boss <= 0 || hero <= 0) break;
    // A parry (energy 0): blocking it does no damage; missing it costs PARRY_HIT.
    if (a.energy === 0) { if (!a.correct) { hero -= PARRY_HIT; combo = 0; } continue; }
    turns++;
    const e = Math.max(1, Math.min(10, Math.round(a.energy)));
    // Written answers are marked like the written quizzes: correct = full hit, partly correct = half a hit.
    const score = a.score ?? (a.correct ? 1 : 0);
    if (score >= 1) { const d = damageOf(e, combo); boss -= d; damage += d; combo++; right++; if (e >= 7) hero = Math.min(HERO_HP, hero + 5); }
    else if (score > 0) { const d = Math.round(damageOf(e, combo) * score); boss -= d; damage += d; }
    else { combo = 0; hero -= hitBack(e); }
  }
  return { won: boss <= 0, lost: hero <= 0, damage, right, turns, bossHp: Math.max(0, boss), heroHp: Math.max(0, hero) };
}

/** Coins and XP for a finished battle. */
export function battleReward(r: { won: boolean; right: number; damage: number }, raid = false) {
  const coins = Math.round(r.damage / 10) + r.right * 2 + (r.won ? 30 : 0);
  const xp = raid ? 15 + Math.round(r.damage / 10) : r.won ? XP.bossWin + r.right * 2 : XP.bossTry;
  return { coins, xp };
}

/** Question difficulty from how the class has done on it: under 50% right is hard, 80%+ easy, unknown medium. */
export function questionTier(answered: number, right: number): Tier {
  if (answered < 3) return 2;
  const p = right / answered;
  return p >= 0.8 ? 1 : p < 0.5 ? 3 : 2;
}

/* ------------------------------------------------------------------ shop */

export type ItemCat = "armor" | "hat" | "sword" | "cape" | "aura";
export type Item = { id: string; n: string; p: number; pal?: Record<string, string>; rb?: boolean; g?: Record<string, string>; col?: string; fx?: string[]; c?: string; t?: string; cols?: string[] };

export const ITEMS: Record<ItemCat, Item[]> = {
  armor: [{ id: "blue", n: "Hero Blue", p: 0 }, { id: "red", n: "Crimson", p: 60, pal: { a: "#e5484d", b: "#9b1c24", y: "#ffd23a" } }, { id: "green", n: "Forest", p: 60, pal: { a: "#3ec96b", b: "#1f7a40", y: "#ffe08a" } }, { id: "purple", n: "Royal Purple", p: 90, pal: { a: "#9b6bff", b: "#5a35b8", y: "#ffd23a" } }, { id: "shadow", n: "Shadow", p: 120, pal: { a: "#3a3f55", b: "#1d2030", y: "#8fc8ff" } }, { id: "gold", n: "Golden", p: 200, pal: { a: "#f5c542", b: "#b8860b", y: "#ffffff" } }, { id: "rainbow", n: "Rainbow", p: 400, rb: true }],
  hat: [{ id: "none", n: "Plain plume", p: 0 }, { id: "headband", n: "Ninja band", p: 50, g: { 3: ".rrrrrrr" } }, { id: "horns", n: "Viking horns", p: 80, g: { "-3": ".w......", "-2": ".ww.....", "-1": "..ww....", 0: "..ww....", 1: "..w....." } }, { id: "wizard", n: "Wizard hat", p: 100, g: { "-5": ".......p", "-4": "......pp", "-3": ".....ppp", "-2": "....pppp", "-1": "...ppppp", 0: ".ppppppp" } }, { id: "crown", n: "Golden crown", p: 150, g: { "-2": "..y.y..y", "-1": "..yyyyyy" } }, { id: "halo", n: "Halo", p: 200, g: { "-3": "....yyyy", "-2": "...y....", "-1": "....yyyy" } }],
  sword: [{ id: "steel", n: "Steel sword", p: 0, col: "#dfe9ff" }, { id: "emerald", n: "Emerald blade", p: 100, col: "#4ade80" }, { id: "fire", n: "Flame blade", p: 120, col: "#ff8a3c", fx: ["#ff7a45", "#ffd23a"] }, { id: "ice", n: "Frost blade", p: 120, col: "#8fd8ff", fx: ["#e6f6ff", "#8fd8ff"] }, { id: "gold", n: "Golden blade", p: 180, col: "#ffd23a", fx: ["#fff6a8"] }, { id: "shadow", n: "Shadow blade", p: 220, col: "#a77bff", fx: ["#a77bff", "#5a35b8"] }, { id: "rainbow", n: "Rainbow blade", p: 400, rb: true, fx: ["#ff7aa8", "#ffd23a", "#5eead4", "#8fc8ff"] }],
  cape: [{ id: "none", n: "No cape", p: 0 }, { id: "red", n: "Red cape", p: 70, c: "#d63a3a", t: "#8f1d1d" }, { id: "royal", n: "Royal blue", p: 80, c: "#3b6cff", t: "#1f3a99" }, { id: "emerald", n: "Emerald", p: 80, c: "#2fbf71", t: "#14724a" }, { id: "shadow", n: "Shadow cloak", p: 100, c: "#2b2f45", t: "#13151f" }, { id: "rainbow", n: "Rainbow cape", p: 300, rb: true }],
  aura: [{ id: "none", n: "No aura", p: 0 }, { id: "sparkle", n: "Sparkles", p: 90, cols: ["#fff6a8", "#ffffff"] }, { id: "hearts", n: "Hearts", p: 90, cols: ["#ff7aa8", "#ffb4cf"] }, { id: "snow", n: "Snowfall", p: 110, cols: ["#e6f6ff", "#bfe3ff"] }, { id: "flame", n: "Flames", p: 140, cols: ["#ff7a45", "#ffb347", "#ffd23a"] }, { id: "stars", n: "Star storm", p: 160, cols: ["#ffd23a", "#ffffff", "#8fc8ff"] }],
};
export const CATS: [ItemCat, string][] = [["armor", "Armor"], ["hat", "Hats"], ["sword", "Swords"], ["cape", "Capes"], ["aura", "Auras"]];
export const DEFAULT_LOOK: Record<ItemCat, string> = { armor: "blue", hat: "none", sword: "steel", cape: "none", aura: "none" };
export const itemOf = (cat: ItemCat, id: string) => ITEMS[cat].find((x) => x.id === id) ?? ITEMS[cat][0];
export const isCat = (c: unknown): c is ItemCat => typeof c === "string" && c in ITEMS;

/** The equipped look, with anything unknown or not owned replaced by the free default. */
export function cleanLook(equipped: Record<string, string>, owned: string[]): Record<ItemCat, string> {
  const out = { ...DEFAULT_LOOK };
  for (const [cat] of CATS) {
    const id = equipped[cat];
    if (id && ITEMS[cat].some((x) => x.id === id) && (itemOf(cat, id).p === 0 || owned.includes(`${cat}:${id}`))) out[cat] = id;
  }
  return out;
}
