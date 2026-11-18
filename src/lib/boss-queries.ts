import "server-only";
import { db } from "./db";
import { battleTurns, parseState } from "./boss-state";
import { MIN_BOSS_QUESTIONS, replayBattle } from "./game";

/** A session's result, replaying multiple-choice and written answers together. */
const result = (items: string, answers: { position: number; energy: number | null; correct: boolean }[]) => {
  const st = parseState(items);
  return replayBattle(st ? battleTurns(answers, st) : [], st?.hp ?? 0);
};

/** The Boss Battles page: each chapter with enough approved questions is a boss; your wins; the class's live raids. */
export async function bossLobby(userId: string, classroomId: string) {
  const [chapters, mine, raids] = await Promise.all([
    db.chapter.findMany({
      where: { subject: { classroomId } },
      orderBy: [{ subject: { position: "asc" } }, { position: "asc" }],
      select: { id: true, name: true, subject: { select: { name: true } }, _count: { select: { mcqs: { where: { status: "APPROVED" } }, questions: { where: { status: "APPROVED" } } } } },
    }),
    db.mcqSession.findMany({
      where: { userId, kind: "boss", raidId: null, chapter: { subject: { classroomId } } },
      orderBy: { createdAt: "desc" }, take: 200,
      select: { chapterId: true, items: true, answers: { orderBy: { position: "asc" }, select: { position: true, energy: true, correct: true } } },
    }),
    db.raid.findMany({
      where: { classroomId, endsAt: { gt: new Date(Date.now() - 864e5) } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, hp: true, endsAt: true, chapter: { select: { id: true, name: true } }, createdBy: { select: { name: true } },
        sessions: { select: { userId: true, user: { select: { name: true } }, items: true, answers: { orderBy: { position: "asc" }, select: { position: true, energy: true, correct: true } } } },
      },
    }),
  ]);
  const wins = new Map<string, number>();
  for (const s of mine) if (s.chapterId && result(s.items, s.answers).won) wins.set(s.chapterId, (wins.get(s.chapterId) ?? 0) + 1);
  return {
    bosses: chapters.filter((c) => c._count.mcqs + c._count.questions >= MIN_BOSS_QUESTIONS).map((c) => ({ id: c.id, name: c.name, subject: c.subject.name, questions: c._count.mcqs + c._count.questions, written: c._count.questions, wins: wins.get(c.id) ?? 0 })),
    locked: chapters.filter((c) => c._count.mcqs + c._count.questions > 0 && c._count.mcqs + c._count.questions < MIN_BOSS_QUESTIONS).map((c) => ({ id: c.id, name: c.name, questions: c._count.mcqs + c._count.questions })),
    raids: raids.map((r) => {
      const byUser = new Map<string, { name: string; damage: number; right: number; you: boolean }>();
      for (const s of r.sessions) {
        const b = result(s.items, s.answers);
        const row = byUser.get(s.userId) ?? { name: s.user.name, damage: 0, right: 0, you: s.userId === userId };
        row.damage += b.damage; row.right += b.right; byUser.set(s.userId, row);
      }
      const players = [...byUser.values()].sort((a, b) => b.damage - a.damage);
      const total = players.reduce((n, p) => n + p.damage, 0);
      return { id: r.id, hp: r.hp, total, defeated: total >= r.hp, ended: r.endsAt < new Date(), endsAt: r.endsAt.toISOString(), chapter: r.chapter, by: r.createdBy.name, players, played: byUser.has(userId) };
    }),
  };
}
