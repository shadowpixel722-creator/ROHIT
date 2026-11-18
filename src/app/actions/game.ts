"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  battleReward, bossHp, cleanLook, isCat, itemOf, MIN_BOSS_QUESTIONS, questionTier, RAID_TURNS, replayBattle, tierOf, XP, type ItemCat, type Tier,
} from "@/lib/game";
import { award, getGame } from "@/lib/game-server";
import OpenAI from "openai";
import { gradeAnswers } from "@/lib/ai-study";
import { battleTurns, parseState, type BossState, type BossItem } from "@/lib/boss-state";
import { record, tooMany } from "@/lib/rate-limit";
import { StudyOutputError } from "@/lib/study-schema";
import { aiEnabled } from "@/lib/transcribe";
import { LESSON_BY_ID } from "@/lib/knowa/lessons";
import { shuffle } from "@/lib/quiz";
import { getToday } from "@/lib/server";

const parse = <T,>(s: string, fallback: T): T => { try { return (JSON.parse(s) as T) ?? fallback; } catch { return fallback; } };

/* ------------------------------------------------------------------ shop */

/** Buys a cosmetic with coins (and puts it on). Cosmetic only: there is no real money anywhere. */
export async function buyItem(cat: string, id: string) {
  return run(async () => {
    const userId = await requireUserId();
    if (!isCat(cat)) throw new UserError("That item doesn't exist.");
    const item = itemOf(cat, id);
    if (item.id !== id) throw new UserError("That item doesn't exist.");
    await getGame(userId); // makes sure the profile exists
    const key = `${cat}:${id}`;
    // Spend the coins only if there are enough (checked in the same update, so two clicks can't overspend).
    const p = await db.gameProfile.findUniqueOrThrow({ where: { userId }, select: { owned: true, equipped: true } });
    const owned = parse<string[]>(p.owned, []);
    if (owned.includes(key) || item.p === 0) return equip(userId, cat, id, owned, p.equipped);
    const spent = await db.gameProfile.updateMany({ where: { userId, coins: { gte: item.p }, owned: p.owned }, data: { coins: { decrement: item.p }, owned: JSON.stringify([...owned, key]) } });
    if (spent.count !== 1) throw new UserError("You don't have enough coins for that yet.");
    return equip(userId, cat, id, [...owned, key], p.equipped);
  });
}

async function equip(userId: string, cat: ItemCat, id: string, owned: string[], equippedJson: string) {
  const look = cleanLook({ ...parse<Record<string, string>>(equippedJson, {}), [cat]: id }, owned);
  await db.gameProfile.update({ where: { userId }, data: { equipped: JSON.stringify(look) } });
  revalidatePath("/hero");
  return { look };
}

/** Puts on an item you own (or a free one). */
export async function equipItem(cat: string, id: string) {
  return run(async () => {
    const userId = await requireUserId();
    if (!isCat(cat)) throw new UserError("That item doesn't exist.");
    await getGame(userId);
    const p = await db.gameProfile.findUniqueOrThrow({ where: { userId }, select: { owned: true, equipped: true } });
    const owned = parse<string[]>(p.owned, []);
    if (itemOf(cat, id).p > 0 && !owned.includes(`${cat}:${id}`)) throw new UserError("Buy it first.");
    return equip(userId, cat, id, owned, p.equipped);
  });
}

/* ------------------------------------------------------------------ lessons */

/** A narrated 3D lesson was watched to the end: XP once per lesson per day. */
export async function lessonFinished(classroomId: string, lessonId: string) {
  return run(async () => {
    const userId = await requireUserId();
    await requireMember(userId, classroomId);
    if (!LESSON_BY_ID[lessonId] && !lessonId.startsWith("note-")) throw new UserError("Lesson not found.");
    return award(userId, { xp: XP.lessonDone, once: `lesson:${lessonId}:${await getToday()}` });
  });
}

/* ------------------------------------------------------------------ Boss Battles */


/**
 * A chapter's boss: its approved multiple-choice questions (rated easy/medium/hard by how the class has
 * done on them) and, when `written`, its approved written questions too (medium, or hard if a full answer
 * needs 3+ key points). Written answers are marked by AI like the written quizzes.
 */
async function bossPool(chapterId: string, written: boolean) {
  const [mcq, wq] = await Promise.all([
    db.mcqQuestion.findMany({ where: { chapterId, status: "APPROVED" }, select: { id: true, answers: { select: { correct: true } } } }),
    written ? db.question.findMany({ where: { chapterId, status: "APPROVED" }, select: { id: true, keyPoints: true } }) : Promise.resolve([]),
  ]);
  return [
    ...mcq.map((q) => ({ id: q.id, kind: "mcq" as const, tier: questionTier(q.answers.length, q.answers.filter((a) => a.correct).length) })),
    ...wq.map((q) => ({ id: q.id, kind: "written" as const, tier: (parse<string[]>(q.keyPoints, []).length >= 3 ? 3 : 2) as Tier })),
  ];
}
/** Written questions need the AI marker, so only for students whose consent form is confirmed (and teachers). */
const canWrite = (access: { role: string; membership: { consentVerifiedAt: Date | null } | null }) => aiEnabled() && (access.role === "TEACHER" || !!access.membership?.consentVerifiedAt);
const allQuestions = (chapterId: string) => Promise.all([db.mcqQuestion.count({ where: { chapterId, status: "APPROVED" } }), db.question.count({ where: { chapterId, status: "APPROVED" } })]).then(([a, b]) => a + b);

/** Starts a battle (or a raid turn set) against a chapter's boss. Questions come only from the class's approved questions. */
export async function startBoss(chapterId: string, raidId?: string | null) {
  return run(async () => {
    const userId = await requireUserId();
    const ch = await db.chapter.findUnique({ where: { id: z.string().min(1).parse(chapterId) }, select: { id: true, name: true, subject: { select: { classroomId: true } } } });
    if (!ch) throw new UserError("Chapter not found.");
    const access = await requireMember(userId, ch.subject.classroomId);
    const written = canWrite(access);
    const pool = await bossPool(ch.id, written);
    if (pool.length < MIN_BOSS_QUESTIONS) {
      if (!written && (await allQuestions(ch.id)) >= MIN_BOSS_QUESTIONS) throw new UserError("This boss uses written questions, which are marked by AI. Your teacher needs to confirm your parent/guardian consent form first.");
      throw new UserError(`This boss needs at least ${MIN_BOSS_QUESTIONS} approved practice questions in the chapter.`);
    }
    let hp = bossHp(pool.length);
    if (raidId) {
      const raid = await db.raid.findUnique({ where: { id: raidId } });
      if (!raid || raid.classroomId !== ch.subject.classroomId || raid.chapterId !== ch.id) throw new UserError("That raid isn't in this class.");
      if (raid.endsAt < new Date()) throw new UserError("That raid has ended.");
      // One set of turns per player per raid (a set left unfinished can be started again).
      const mine = await db.mcqSession.findMany({ where: { raidId, userId, kind: "boss" }, select: { items: true } });
      if (mine.some((m) => { const st = parseState(m.items); return !!st && (st.done || st.turns >= RAID_TURNS); })) throw new UserError("You've already had your turns in this raid.");
      hp = raid.hp;
    }
    const state: BossState = { boss: true, qs: shuffle(pool).map((q): BossItem => ({ id: q.id, kind: q.kind, tier: q.tier, perm: shuffle([0, 1, 2, 3]) })), used: [], pending: null, energy: 5, turns: 0, hp, pos: 0, log: [], written };
    const session = await db.mcqSession.create({ data: { userId, chapterId: ch.id, kind: "boss", raidId: raidId ?? null, items: JSON.stringify(state) } });
    return { sessionId: session.id, hp, energy: state.energy, turnsLeft: raidId ? RAID_TURNS : null, chapter: ch.name, written: written && pool.some((q) => q.kind === "written") };
  });
}

async function bossSession(userId: string, sessionId: string) {
  const s = await db.mcqSession.findUnique({ where: { id: sessionId }, include: { answers: { orderBy: { position: "asc" }, select: { position: true, energy: true, correct: true } } } });
  if (!s || s.userId !== userId || s.kind !== "boss") throw new UserError("Battle not found.");
  const state = parseState(s.items);
  if (!state) throw new UserError("Battle not found.");
  return { s, state, turns: battleTurns(s.answers, state) };
}
const save = (id: string, state: BossState) => db.mcqSession.update({ where: { id }, data: { items: JSON.stringify(state) } });
const over = (s: { raidId: string | null }, state: BossState, turns: ReturnType<typeof battleTurns>) => {
  const r = replayBattle(turns, state.hp);
  return state.done || r.won || r.lost || (!!s.raidId && state.turns >= RAID_TURNS);
};

/**
 * The next question: spend `energy` (1–10; 0 = a parry, a fixed medium question). Higher energy picks a
 * harder question. You can't spend more energy than you have.
 */
export async function nextBossQuestion(sessionId: string, energy: number) {
  return run(async () => {
    const userId = await requireUserId();
    const { s, state, turns } = await bossSession(userId, sessionId);
    if (over(s, state, turns)) throw new UserError("This battle is over.");
    const e = z.number().int().min(0).max(10).parse(energy);
    if (e > state.energy) throw new UserError("You don't have that much energy.");
    const want: Tier = e === 0 ? 2 : tierOf(e);
    // A parry is timed, so it's always multiple choice.
    const ok = (q: BossItem) => e > 0 || q.kind === "mcq";
    let pool = state.qs.map((q, i) => ({ q, i })).filter((x) => ok(x.q) && !state.used.includes(x.q.id));
    if (!pool.length) { state.used = state.used.filter((id) => !state.qs.some((q) => q.id === id && ok(q))); pool = state.qs.map((q, i) => ({ q, i })).filter((x) => ok(x.q)); }
    if (!pool.length) throw new UserError("No questions left for this attack.");
    const near = Math.min(...pool.map((x) => Math.abs(x.q.tier - want)));
    const pick = pool.filter((x) => Math.abs(x.q.tier - want) === near)[Math.floor(Math.random() * pool.filter((x) => Math.abs(x.q.tier - want) === near).length)];
    state.used.push(pick.q.id);
    state.pending = { i: pick.i, energy: e };
    if (pick.q.kind === "written") {
      const w = await db.question.findUnique({ where: { id: pick.q.id }, select: { question: true } });
      if (!w) throw new UserError("This question was removed. Try again.");
      await save(s.id, state);
      return { kind: "written" as const, stem: w.question, choices: [] as string[], tier: pick.q.tier, energy: e };
    }
    const q = await db.mcqQuestion.findUnique({ where: { id: pick.q.id }, select: { stem: true, choices: true } });
    if (!q) throw new UserError("This question was removed. Try again.");
    await save(s.id, state);
    const choices = JSON.parse(q.choices) as string[];
    return { kind: "mcq" as const, stem: q.stem, choices: pick.q.perm.map((p) => choices[p]), tier: pick.q.tier, energy: e };
  });
}

const VERDICT_SCORE: Record<string, number> = { CORRECT: 1, PARTLY: 0.5, INCORRECT: 0, SKIPPED: 0 };

/**
 * Answers the pending question: a choice (null = ran out of time on a parry), or `text` for a written
 * question, which is marked by AI exactly like the written quizzes (correct = full hit, partly = half).
 * Multiple-choice answers are recorded like practice answers; written ones as a one-question quiz
 * attempt. Both feed the Mistake Map.
 */
export async function answerBoss(sessionId: string, chosen: number | null, text?: string) {
  return run(async () => {
    const userId = await requireUserId();
    const { s, state, turns } = await bossSession(userId, sessionId);
    if (!state.pending) throw new UserError("Choose your attack first.");
    const item = state.qs[state.pending.i];
    const energy = state.pending.energy;
    const pos = Math.max(state.pos, turns.length ? turns[turns.length - 1].pos + 1 : 0);
    const turnsLeft = () => (s.raidId ? Math.max(0, RAID_TURNS - state.turns) : null);
    const after = (score: number) => {
      state.pending = null; state.pos = pos + 1;
      if (energy > 0) { state.turns++; state.energy = Math.max(0, Math.min(10, state.energy - energy + 2 + (score >= 1 ? 1 : 0))); }
      else if (score >= 1) state.energy = Math.min(10, state.energy + 2);
    };

    if (item.kind === "written") {
      const answer = z.string().max(1200).parse(text ?? "").trim().slice(0, 600);
      const q = await db.question.findUnique({ where: { id: item.id }, select: { id: true, question: true, answer: true, keyPoints: true, chapterId: true, chapter: { select: { subject: { select: { classroomId: true } } } } } });
      if (!q) throw new UserError("This question was removed. Try another.");
      let grade = { verdict: "SKIPPED" as string, feedback: "You left this one blank." };
      if (answer.length >= 2) {
        if (tooMany(`grade:${userId}`, 20, 3_600_000)) throw new UserError("You've had a lot of answers marked in the last hour. Try a multiple-choice attack instead.");
        record(`grade:${userId}`);
        const classroomId = q.chapter.subject.classroomId;
        try {
          const out = await gradeAnswers([{ question: q.question, answer: q.answer, keyPoints: parse<string[]>(q.keyPoints, []), studentAnswer: answer }]);
          await db.aiUsage.create({ data: { classroomId, model: "grade", kind: "GRADE", inputTokens: out.inputTokens, outputTokens: out.outputTokens } });
          if (out.searches) await db.aiUsage.createMany({ data: Array.from({ length: out.searches }, () => ({ classroomId, model: "web_search", kind: "SEARCH", inputTokens: 0, outputTokens: 0 })) });
          grade = out.grades[0];
        } catch (e) {
          if (e instanceof StudyOutputError || e instanceof OpenAI.APIError) throw new UserError("The marker couldn't check that just now. Press Strike again.");
          throw e;
        }
      }
      const score = VERDICT_SCORE[grade.verdict] ?? 0;
      await db.quizAttempt.create({ data: { userId, chapterId: q.chapterId, noteIds: "[]", items: JSON.stringify([q.id]), answers: JSON.stringify([answer]), grades: JSON.stringify([grade]), score, total: 1, submittedAt: new Date(), confidence: JSON.stringify([null]) } });
      state.log.push({ pos, energy, score });
      after(score);
      await save(s.id, state);
      const r = replayBattle([...turns, { pos, energy, correct: score >= 1, score }], state.hp);
      return { kind: "written" as const, correct: score >= 1, score, verdict: grade.verdict, feedback: grade.feedback, modelAnswer: q.answer, correctPosition: -1, why: "", trap: null, energy: state.energy, ...r, turnsLeft: turnsLeft() };
    }

    const pick = z.number().int().min(0).max(3).nullable().parse(chosen);
    const q = await db.mcqQuestion.findUnique({ where: { id: item.id }, include: { distractors: { include: { misconception: { select: { id: true, label: true, fix: true } } } } } });
    if (!q) throw new UserError("This question was removed. Try another.");
    const original = pick === null ? -1 : item.perm[pick], correct = original === q.answerIndex;
    const trap = correct ? null : q.distractors.find((d) => d.choiceIndex === original)?.misconception ?? null;
    await db.mcqAnswer.create({ data: { sessionId: s.id, position: pos, userId, questionId: q.id, chosenIndex: original, correct, misconceptionId: trap?.id ?? null, energy } });
    after(correct ? 1 : 0);
    await save(s.id, state);
    const r = replayBattle([...turns, { pos, energy, correct, score: correct ? 1 : 0 }], state.hp);
    return { kind: "mcq" as const, correct, score: correct ? 1 : 0, verdict: correct ? "CORRECT" : "INCORRECT", feedback: "", modelAnswer: "", correctPosition: item.perm.indexOf(q.answerIndex), why: q.explanation, trap: trap ? { label: trap.label, fix: trap.fix } : null, energy: state.energy, ...r, turnsLeft: turnsLeft() };
  });
}

/** Charge: skip your attack to gain 3 energy (it uses a turn in a raid). */
export async function chargeBoss(sessionId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const { s, state, turns } = await bossSession(userId, sessionId);
    if (over(s, state, turns)) throw new UserError("This battle is over.");
    state.energy = Math.min(10, state.energy + 3); state.turns++; state.pending = null;
    await save(s.id, state);
    return { energy: state.energy, turnsLeft: s.raidId ? Math.max(0, RAID_TURNS - state.turns) : null };
  });
}

/** Ends a battle: the server replays the recorded answers to decide the result and the reward (once per battle). */
export async function finishBoss(sessionId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const { s, state, turns } = await bossSession(userId, sessionId);
    const r = replayBattle(turns, state.hp);
    const reward = battleReward(r, !!s.raidId);
    state.done = true;
    await save(s.id, state);
    const given = await award(userId, { xp: reward.xp, coins: reward.coins, once: `boss:${s.id}` });
    if (s.chapterId) revalidatePath(`/classes`, "layout");
    return { ...r, xp: given.xp, coins: given.coins, raid: !!s.raidId };
  });
}

/* ------------------------------------------------------------------ team raids */

/** Starts a class raid on a chapter's boss (one at a time per chapter). Its HP grows with the class size. */
export async function createRaid(chapterId: string) {
  return run(async () => {
    const userId = await requireUserId();
    const ch = await db.chapter.findUnique({ where: { id: z.string().min(1).parse(chapterId) }, select: { id: true, subject: { select: { classroomId: true } } } });
    if (!ch) throw new UserError("Chapter not found.");
    const classroomId = ch.subject.classroomId;
    await requireMember(userId, classroomId);
    if ((await allQuestions(ch.id)) < MIN_BOSS_QUESTIONS) throw new UserError(`A raid needs at least ${MIN_BOSS_QUESTIONS} approved practice questions in the chapter.`);
    const live = await db.raid.findFirst({ where: { classroomId, chapterId: ch.id, endsAt: { gt: new Date() } } });
    if (live) return { raidId: live.id };
    const students = await db.membership.count({ where: { classroomId, role: "STUDENT", status: "ACTIVE" } });
    const raid = await db.raid.create({ data: { classroomId, chapterId: ch.id, hp: 350 * Math.min(6, Math.max(2, students)), createdById: userId, endsAt: new Date(Date.now() + 3 * 864e5) } });
    revalidatePath(`/classes/${classroomId}/boss`);
    return { raidId: raid.id };
  });
}
