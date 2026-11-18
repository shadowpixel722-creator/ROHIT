/**
 * A Boss Battle's saved state (kept on its McqSession) and its full answer history. Multiple-choice answers
 * are McqAnswer rows; written answers are marked like the written quizzes and logged here with their score
 * (each is also saved as a one-question quiz attempt, so it feeds the Mistake Map). Pure.
 */
import type { Tier } from "./game";

export type BossItem = { id: string; kind: "mcq" | "written"; perm: number[]; tier: Tier };
export type BossLog = { pos: number; energy: number; score: number };
export type BossState = { boss: true; qs: BossItem[]; used: string[]; pending: { i: number; energy: number } | null; energy: number; turns: number; hp: number; pos: number; log: BossLog[]; written: boolean; done?: boolean };

export const parseState = (s: string): BossState | null => {
  try {
    const x = JSON.parse(s) as Partial<BossState>;
    if (!x?.boss) return null;
    // Battles started before written questions joined have no log/pos.
    return { written: false, log: [], pos: 0, ...x, qs: (x.qs ?? []).map((q) => ({ ...q, kind: q.kind ?? "mcq" })) } as BossState;
  } catch { return null; }
};

/** Every answer in the order given: multiple choice (from the database) and written (from the log). */
export function battleTurns(mcq: { position: number; energy: number | null; correct: boolean }[], state: Pick<BossState, "log">) {
  return [
    ...mcq.map((a) => ({ pos: a.position, energy: a.energy ?? 0, correct: a.correct, score: a.correct ? 1 : 0 })),
    ...state.log.map((l) => ({ pos: l.pos, energy: l.energy, correct: l.score >= 1, score: l.score })),
  ].sort((a, b) => a.pos - b.pos);
}
