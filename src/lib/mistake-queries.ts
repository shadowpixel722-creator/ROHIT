import "server-only";
import { db } from "./db";
import { toConfidence, type Answered } from "./confidence";
import { classMap, madeMistakes, profile, type Chance, type ClassTrap, type Trap } from "./mistakes";
import { buildGraph, type TopicGraph } from "./topic-graph";
import { subjectColor } from "./constants";
import { classQuestionMap, marksFromAttempts, studentQuestionMistakes, type ClassQuestion, type QuestionMistake } from "./quiz-mistakes";

/** Turns answers into "chances": one per misconception that the answered question had a trap for. */
function chancesOf(answers: { misconceptionId: string | null; createdAt: Date; confidence: string | null; question: { distractors: { misconceptionId: string }[]; chapter: { name: string; subject: { name: string } } } }[]): Chance[] {
  return answers.flatMap((a) => [...new Set(a.question.distractors.map((d) => d.misconceptionId))].map((m) => ({
    misconceptionId: m, fell: a.misconceptionId === m, at: a.createdAt.getTime(), chapter: a.question.chapter.name, subject: a.question.chapter.subject.name,
    confidence: toConfidence(a.confidence),
  })));
}

const answerSelect = {
  userId: true, misconceptionId: true, createdAt: true, confidence: true, correct: true,
  question: { select: { chapterId: true, distractors: { select: { misconceptionId: true } }, chapter: { select: { name: true, subject: { select: { name: true } } } } } },
} as const;

/** How many approved practice questions set a trap for each misconception (so we know if "Practise this" can work). */
async function questionCounts(misconceptionIds: string[]) {
  const rows = await db.mcqDistractor.findMany({ where: { misconceptionId: { in: misconceptionIds }, question: { status: "APPROVED" } }, select: { misconceptionId: true, questionId: true } });
  const out = new Map<string, Set<string>>();
  for (const r of rows) (out.get(r.misconceptionId) ?? out.set(r.misconceptionId, new Set()).get(r.misconceptionId)!).add(r.questionId);
  return new Map([...out].map(([k, v]) => [k, v.size]));
}

export type StudentTrap = Trap & { label: string; fix: string; subjectName: string; classroomId: string; practiceQuestions: number; chapterIds: string[] };

const studentAnswers = (userId: string, classroomIds: string[]) => db.mcqAnswer.findMany({
  where: { userId, question: { chapter: { subject: { classroomId: { in: classroomIds } } } } },
  orderBy: { createdAt: "asc" },
  select: answerSelect,
});

/** One student's own traps in a class (or several classes), worst first. Reads only that student's answers. */
export async function studentTraps(userId: string, classroomIds: string[], answersIn?: Awaited<ReturnType<typeof studentAnswers>>): Promise<StudentTrap[]> {
  const answers = answersIn ?? await studentAnswers(userId, classroomIds);
  const traps = madeMistakes(profile(chancesOf(answers))); // only mistakes this student has actually made
  /** Chapters where the student met each trap. */
  const met = new Map<string, Set<string>>();
  for (const a of answers) for (const d of a.question.distractors) (met.get(d.misconceptionId) ?? met.set(d.misconceptionId, new Set()).get(d.misconceptionId)!).add(a.question.chapterId);
  if (traps.length === 0) return [];
  const ids = traps.map((t) => t.misconceptionId);
  const [rows, counts] = await Promise.all([
    db.misconception.findMany({ where: { id: { in: ids } }, select: { id: true, label: true, fix: true, subject: { select: { name: true, classroomId: true } } } }),
    questionCounts(ids),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return traps.filter((t) => byId.has(t.misconceptionId)).map((t) => ({
    ...t, label: byId.get(t.misconceptionId)!.label, fix: byId.get(t.misconceptionId)!.fix,
    subjectName: byId.get(t.misconceptionId)!.subject.name, classroomId: byId.get(t.misconceptionId)!.subject.classroomId, practiceQuestions: counts.get(t.misconceptionId) ?? 0,
    chapterIds: [...(met.get(t.misconceptionId) ?? [])],
  }));
}

/* ------------------------------------------------------------------ the student's own topic map */

export type StudentMistakeMap = { traps: StudentTrap[]; quiz: StudentQuizMistake[]; graph: TopicGraph; answered: Answered[] };

/**
 * Everything for one student's Mistake Map in a class: their traps, written-quiz mistakes, every answer with
 * its confidence (for "how well do you know what you know"), and the topic map. Reads only that student's data.
 */
export async function studentMistakeMap(userId: string, classroomId: string): Promise<StudentMistakeMap> {
  const [mcq, attempts, subjects] = await Promise.all([
    studentAnswers(userId, [classroomId]),
    db.quizAttempt.findMany({ where: { userId, submittedAt: { not: null }, chapter: { subject: { classroomId } } }, select: { ...attemptSelect, chapterId: true } }),
    db.subject.findMany({
      where: { classroomId },
      orderBy: { position: "asc" },
      select: { id: true, name: true, color: true, chapters: { orderBy: { position: "asc" }, select: { id: true, name: true, position: true, _count: { select: { mcqs: { where: { status: "APPROVED" } }, questions: { where: { status: "APPROVED" } } } } } } },
    }),
  ]);
  const traps = await studentTraps(userId, [classroomId], mcq);
  const quiz = await quizMistakesFrom(attempts);

  // Every answer, by chapter and in time order: multiple choice (right or wrong) and written (only "Correct" counts as right).
  const timed: (Answered & { at: number; chapterId: string })[] = [
    ...mcq.map((a) => ({ chapterId: a.question.chapterId, correct: a.correct, confidence: toConfidence(a.confidence), at: a.createdAt.getTime() })),
    ...attempts.flatMap((a) => {
      const ids = new Set(parseIds(a.items));
      return marksFromAttempts([a]).filter((m) => ids.has(m.questionId)).map((m) => ({ chapterId: a.chapterId, correct: m.verdict === "CORRECT", confidence: m.confidence, at: m.at }));
    }),
  ].sort((x, y) => x.at - y.at);
  const byChapter = new Map<string, Answered[]>();
  for (const a of timed) (byChapter.get(a.chapterId) ?? byChapter.set(a.chapterId, []).get(a.chapterId)!).push({ correct: a.correct, confidence: a.confidence });

  const chapters = subjects.flatMap((s) => s.chapters
    .filter((c) => c._count.mcqs + c._count.questions > 0 || byChapter.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, position: c.position, subjectId: s.id })));
  const graph = buildGraph({
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, color: subjectColor(s.color) })),
    chapters,
    answers: byChapter,
    traps: traps.map((t) => ({ id: t.misconceptionId, label: t.label, status: t.status, sureFalls: t.sureFalls, falls: t.falls, chances: t.chances, chapterIds: t.chapterIds })),
    missed: quiz.filter((q) => q.still).map((q) => ({ id: q.questionId, question: q.question, chapterId: q.chapterId, sure: q.sureMisses > 0 })),
  });
  return { traps, quiz, graph, answered: timed.map(({ correct, confidence }) => ({ correct, confidence })) };
}

const parseIds = (s: string) => { try { return JSON.parse(s) as string[]; } catch { return []; } };

/** A wrong answer students picked for this trap: the question, the option they chose, and how many times. */
export type PickedAnswer = { question: string; picked: string; correct: string; times: number };

export type ClassTrapRow = ClassTrap & { label: string; fix: string; subjectName: string; classroomId: string; practiceQuestions: number; topPicks: PickedAnswer[]; chapterId: string; chapterName: string };

export type ClassMistakeSummary = { practising: number; withActive: number; mistakes: number; wrongPicks: number };

/**
 * The mistakes a class is actually making: only misconceptions at least one student has fallen for, with how many
 * students fell for them, how many still do, and the wrong answers they picked most. Counts only, never names;
 * the percentage is hidden below 3 students (see classMap).
 */
export async function classTrapMap(classroomIds: string[]): Promise<ClassTrapRow[]> {
  return (await classMistakes(classroomIds)).rows;
}

/** The class's mistakes plus totals for the summary row. Students are counted, never named. */
export async function classMistakes(classroomIds: string[]): Promise<{ rows: ClassTrapRow[]; summary: ClassMistakeSummary }> {
  const empty = { rows: [], summary: { practising: 0, withActive: 0, mistakes: 0, wrongPicks: 0 } };
  if (classroomIds.length === 0) return empty;
  const students = { role: "STUDENT", memberships: { some: { classroomId: { in: classroomIds }, role: "STUDENT", status: "ACTIVE" } } } as const;
  const answers = await db.mcqAnswer.findMany({
    where: { question: { chapter: { subject: { classroomId: { in: classroomIds } } } }, user: students },
    orderBy: { createdAt: "asc" },
    select: answerSelect,
  });
  const byStudent = new Map<string, typeof answers>();
  for (const a of answers) (byStudent.get(a.userId) ?? byStudent.set(a.userId, []).get(a.userId)!).push(a);
  const profiles = [...byStudent.values()].map((list) => profile(chancesOf(list)));
  const map = classMap(profiles);
  const summary: ClassMistakeSummary = {
    practising: byStudent.size,
    withActive: profiles.filter((p) => p.some((t) => t.status === "ACTIVE")).length,
    mistakes: map.length,
    wrongPicks: map.reduce((n, m) => n + m.falls, 0),
  };
  if (map.length === 0) return { rows: [], summary };
  const ids = map.map((m) => m.misconceptionId);

  const [rows, counts, picks] = await Promise.all([
    db.misconception.findMany({ where: { id: { in: ids } }, select: { id: true, label: true, fix: true, subject: { select: { name: true, classroomId: true } } } }),
    questionCounts(ids),
    db.mcqAnswer.groupBy({ by: ["misconceptionId", "questionId", "chosenIndex"], where: { misconceptionId: { in: ids }, user: students }, _count: true }),
  ]);
  const questions = new Map((await db.mcqQuestion.findMany({ where: { id: { in: [...new Set(picks.map((p) => p.questionId))] } }, select: { id: true, stem: true, choices: true, answerIndex: true, chapter: { select: { id: true, name: true, position: true } } } })).map((q) => [q.id, q]));
  /** The chapter where students fell for this trap most. */
  const mainChapter = (m: string) => {
    const tally = new Map<string, { id: string; name: string; position: number; n: number }>();
    for (const p of picks) {
      const q = questions.get(p.questionId);
      if (p.misconceptionId !== m || !q) continue;
      const row = tally.get(q.chapter.id) ?? { ...q.chapter, n: 0 };
      row.n += p._count;
      tally.set(q.chapter.id, row);
    }
    return [...tally.values()].sort((a, b) => b.n - a.n)[0] ?? { id: "", name: "Other", position: 9999, n: 0 };
  };
  const topPicks = (m: string): PickedAnswer[] => picks
    .filter((p) => p.misconceptionId === m && questions.has(p.questionId))
    .sort((a, b) => b._count - a._count)
    .slice(0, 3)
    .map((p) => {
      const q = questions.get(p.questionId)!;
      const choices = JSON.parse(q.choices) as string[];
      return { question: q.stem, picked: choices[p.chosenIndex] ?? "", correct: choices[q.answerIndex] ?? "", times: p._count };
    });

  const byId = new Map(rows.map((r) => [r.id, r]));
  return {
    summary,
    rows: map.filter((m) => byId.has(m.misconceptionId)).map((m) => {
      const r = byId.get(m.misconceptionId)!;
      const ch = mainChapter(m.misconceptionId);
      return { ...m, label: r.label, fix: r.fix, subjectName: r.subject.name, classroomId: r.subject.classroomId, practiceQuestions: counts.get(m.misconceptionId) ?? 0, topPicks: topPicks(m.misconceptionId), chapterId: ch.id, chapterName: ch.name };
    }),
  };
}

/* ------------------------------------------------------------------ written quizzes */

type QuestionInfo = { question: string; answer: string; keyPoints: string[]; chapterId: string; chapterName: string; chapterPosition: number; subjectName: string };

async function questionInfo(ids: string[]) {
  const rows = await db.question.findMany({
    where: { id: { in: ids } },
    select: { id: true, question: true, answer: true, keyPoints: true, chapter: { select: { id: true, name: true, position: true, subject: { select: { name: true } } } } },
  });
  return new Map(rows.map((q): [string, QuestionInfo] => {
    let keyPoints: string[] = [];
    try { keyPoints = JSON.parse(q.keyPoints) as string[]; } catch { /* keep empty */ }
    return [q.id, { question: q.question, answer: q.answer, keyPoints, chapterId: q.chapter.id, chapterName: q.chapter.name, chapterPosition: q.chapter.position, subjectName: q.chapter.subject.name }];
  }));
}

const attemptSelect = { userId: true, items: true, answers: true, grades: true, submittedAt: true, confidence: true } as const;

export type StudentQuizMistake = QuestionMistake & QuestionInfo;

/** One student's own written-quiz mistakes in a class. Reads only that student's attempts. */
export async function studentQuizMistakes(userId: string, classroomId: string): Promise<StudentQuizMistake[]> {
  const attempts = await db.quizAttempt.findMany({ where: { userId, submittedAt: { not: null }, chapter: { subject: { classroomId } } }, select: attemptSelect });
  return quizMistakesFrom(attempts);
}

async function quizMistakesFrom(attempts: Parameters<typeof marksFromAttempts>[0]): Promise<StudentQuizMistake[]> {
  const list = studentQuestionMistakes(marksFromAttempts(attempts));
  const info = await questionInfo(list.map((q) => q.questionId));
  return list.flatMap((q) => (info.has(q.questionId) ? [{ ...q, ...info.get(q.questionId)! }] : [])); // deleted questions drop out
}

export type ClassQuizRow = ClassQuestion & QuestionInfo;

/** Written questions the class gets wrong, with counts only (never names, answers or feedback). */
export async function classQuizMistakes(classroomId: string): Promise<{ rows: ClassQuizRow[]; quizzers: number }> {
  const attempts = await db.quizAttempt.findMany({
    where: { submittedAt: { not: null }, chapter: { subject: { classroomId } }, user: { role: "STUDENT", memberships: { some: { classroomId, role: "STUDENT", status: "ACTIVE" } } } },
    select: attemptSelect,
  });
  const byStudent = new Map<string, typeof attempts>();
  for (const a of attempts) (byStudent.get(a.userId) ?? byStudent.set(a.userId, []).get(a.userId)!).push(a);
  const map = classQuestionMap([...byStudent.values()].map(marksFromAttempts));
  const info = await questionInfo(map.map((q) => q.questionId));
  return { rows: map.flatMap((q) => (info.has(q.questionId) ? [{ ...q, ...info.get(q.questionId)! }] : [])), quizzers: byStudent.size };
}
