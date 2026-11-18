import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { DAILY_COINS, cleanLook, hitDay, catchUp, levelOf, type StreakState } from "./game";
import { getToday } from "./server";

type Row = { xp: number; coins: number; streak: number; best: number; lastDay: string | null; freezes: number; days: string; owned: string; equipped: string };
const parse = <T,>(s: string, fallback: T): T => { try { return (JSON.parse(s) as T) ?? fallback; } catch { return fallback; } };
const stateOf = (r: Row): StreakState => ({ streak: r.streak, best: r.best, lastDay: r.lastDay, freezes: r.freezes, days: parse(r.days, {}) });

export type GameView = ReturnType<typeof view>;
function view(r: Row, today: string) {
  const s = catchUp(stateOf(r), today);
  const owned = parse<string[]>(r.owned, []);
  return {
    xp: r.xp, coins: r.coins, level: levelOf(r.xp), owned, look: cleanLook(parse(r.equipped, {}), owned),
    streak: s.streak, best: Math.max(s.best, s.streak), freezes: s.freezes, days: s.days, today, doneToday: s.lastDay === today,
  };
}

async function row(userId: string): Promise<Row> {
  return db.gameProfile.upsert({ where: { userId }, create: { userId }, update: {} });
}

/** Someone's game progress, with the streak brought up to today (freezes used, or the streak ended). */
export async function getGame(userId: string): Promise<GameView> {
  const today = await getToday();
  const r = await row(userId);
  const s = catchUp(stateOf(r), today);
  if (s.used || s.lost) await db.gameProfile.update({ where: { userId }, data: { streak: s.streak, lastDay: s.lastDay, freezes: s.freezes, days: JSON.stringify(s.days) } });
  return view(r, today);
}

export type AwardResult = { xp: number; coins: number; streak: number; firstToday: boolean; earnedFreeze: boolean; given: boolean };

/**
 * Gives XP and coins for learning, and counts today towards the streak (the first learning of the day also
 * gives DAILY_COINS). With `once`, the reward is given only the first time that key is used (e.g. finishing
 * the same lesson twice in a day counts once). Never throws for a duplicate: it just gives nothing.
 */
export async function award(userId: string, a: { xp?: number; coins?: number; once?: string }): Promise<AwardResult> {
  const today = await getToday();
  let xp = Math.max(0, Math.round(a.xp ?? 0)), coins = Math.max(0, Math.round(a.coins ?? 0)), given = true;
  if (a.once) {
    try {
      await db.gameAward.create({ data: { userId, key: a.once.slice(0, 120), xp, coins } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { xp = 0; coins = 0; given = false; } else throw e;
    }
  }
  const r = await row(userId);
  const s = hitDay(stateOf(r), today);
  if (s.first) coins += DAILY_COINS;
  await db.gameProfile.update({
    where: { userId },
    data: { xp: { increment: xp }, coins: { increment: coins }, streak: s.streak, best: s.best, lastDay: s.lastDay, freezes: s.freezes, days: JSON.stringify(s.days) },
  });
  return { xp, coins, streak: s.streak, firstToday: s.first, earnedFreeze: s.earnedFreeze, given };
}

/** Award for learning, but never let a game problem break the learning action it's attached to. */
export async function awardQuietly(userId: string, a: Parameters<typeof award>[1]): Promise<AwardResult | null> {
  try { return await award(userId, a); } catch (e) { console.error("game award failed", e instanceof Error ? e.message : e); return null; }
}
