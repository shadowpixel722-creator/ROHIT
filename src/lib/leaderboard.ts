/**
 * The app-wide leaderboard (product owner, 2026-11-19: one board across the whole app; the teacher can
 * switch it off per class). Three boards: XP, coins, and questions answered perfectly (multiple-choice
 * answers that were right, plus written-quiz answers marked fully Correct). Only students appear. A
 * student in any class whose teacher switched it off is left off the board and doesn't see it.
 * Students without a class always appear.
 */
import { db } from "./db";
import type { Grade } from "./quiz";

export const BOARD_SIZE = 10;
export type Metric = "xp" | "coins" | "perfect";
export type BoardRow = { rank: number; name: string; value: number; you: boolean };
export type Board = { metric: Metric; rows: BoardRow[]; you: { rank: number; value: number } | null };

/**
 * Ranks people by value, highest first. Ties share a rank ("1, 2, 2, 4"); ties are listed by name.
 * People with 0 aren't ranked. Returns the top `size` rows and, separately, the viewer's own rank.
 */
export function rankBoard(metric: Metric, people: { id: string; name: string; value: number }[], viewerId: string | null, size = BOARD_SIZE): Board {
  const sorted = people.filter((p) => p.value > 0).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  let rank = 0;
  const ranked = sorted.map((p, i) => { if (i === 0 || p.value !== sorted[i - 1].value) rank = i + 1; return { ...p, rank }; });
  const mine = ranked.find((p) => p.id === viewerId);
  return {
    metric,
    rows: ranked.slice(0, size).map((p) => ({ rank: p.rank, name: p.name, value: p.value, you: p.id === viewerId })),
    you: mine ? { rank: mine.rank, value: mine.value } : null,
  };
}

/** Written-quiz answers marked fully Correct in one attempt's saved grades. */
export function perfectWritten(grades: string | null) {
  try { return ((JSON.parse(grades ?? "[]") as Grade[]) ?? []).filter((g) => g?.verdict === "CORRECT").length; } catch { return 0; }
}

/** Students who may be on the board: role STUDENT, and not in any class whose teacher switched it off. */
const eligible = { role: "STUDENT", memberships: { none: { status: "ACTIVE", role: "STUDENT", classroom: { leaderboard: false } } } } as const;

/** Whether this person may see the board: teachers always; students unless a class of theirs has it off. */
export async function canSeeLeaderboard(userId: string, role: string) {
  if (role === "TEACHER") return true;
  return (await db.user.count({ where: { id: userId, ...eligible } })) > 0;
}

/** The three boards, with the viewer's own rank on each. */
export async function leaderboards(viewerId: string): Promise<Board[]> {
  const students = await db.user.findMany({ where: eligible, select: { id: true, name: true, game: { select: { xp: true, coins: true } } } });
  const ids = students.map((s) => s.id);
  const [mcq, quizzes] = await Promise.all([
    db.mcqAnswer.groupBy({ by: ["userId"], where: { correct: true, userId: { in: ids } }, _count: true }),
    db.quizAttempt.findMany({ where: { userId: { in: ids }, submittedAt: { not: null }, grades: { not: null } }, select: { userId: true, grades: true } }),
  ]);
  const perfect = new Map(mcq.map((r) => [r.userId, r._count]));
  for (const q of quizzes) perfect.set(q.userId, (perfect.get(q.userId) ?? 0) + perfectWritten(q.grades));
  const people = (value: (s: (typeof students)[number]) => number) => students.map((s) => ({ id: s.id, name: s.name, value: value(s) }));
  return [
    rankBoard("xp", people((s) => s.game?.xp ?? 0), viewerId),
    // Everyone starts with 60 coins, so accounts that haven't learned anything yet (no XP) aren't ranked for coins.
    rankBoard("coins", people((s) => (s.game?.xp ? s.game.coins : 0)), viewerId),
    rankBoard("perfect", people((s) => perfect.get(s.id) ?? 0), viewerId),
  ];
}
