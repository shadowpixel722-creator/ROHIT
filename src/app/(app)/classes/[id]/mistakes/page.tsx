import { ArrowRight, Gauge, Network, PenLine, ShieldAlert, Target } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarList } from "@/components/charts";
import { TopicMap, type TrapInfo } from "@/components/study/topic-map";
import { MakeTrapQuestions, TrapPractice } from "@/components/study/trap-tools";
import { Badge, Card, CardHeader, Chevron, cn, Collapsible, EmptyState } from "@/components/ui";
import { getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { calibration, calibrationAdvice, CONFIDENCE_LABEL, CONFIDENCES, MIN_RATED, percent, type Answered } from "@/lib/confidence";
import { classMistakes, classQuizMistakes, studentMistakeMap, type ClassQuizRow, type StudentQuizMistake, type StudentTrap } from "@/lib/mistake-queries";
import { classTrapSentence, STATUS_LABEL, trapConfidenceNote, trapProgress, trapSentence, type TrapStatus } from "@/lib/mistakes";
import { MIN_GROUP } from "@/lib/progress";
import { VERDICT_LABEL } from "@/lib/quiz";
import { classQuestionSentence } from "@/lib/quiz-mistakes";

export const metadata = { title: "Mistake Map" };

const TONE: Record<TrapStatus, "danger" | "warn" | "success" | "neutral"> = { ACTIVE: "danger", FADING: "warn", FIXED: "success", CLEAR: "neutral" };

export default async function MistakesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  return access.role === "TEACHER" ? <TeacherMap classroomId={id} /> : <StudentMap classroomId={id} userId={user.id} />;
}

/* ------------------------------------------------------------------ students */

function History({ history, bad = "Fell for it", good = "Avoided it" }: { history: boolean[]; bad?: string; good?: string }) {
  const recent = history.slice(-12);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Last ${recent.length} tries: ${recent.filter(Boolean).length} ${bad.toLowerCase()}`}>
      {recent.map((fell, i) => <span key={i} className={cn("size-2.5 rounded-full", fell ? "bg-danger" : "bg-success")} title={fell ? bad : good} />)}
    </span>
  );
}

/** A written-quiz question the student missed: what they wrote, the feedback and the model answer. */
function QuizMistakeCard({ q, classroomId }: { q: StudentQuizMistake; classroomId: string }) {
  return (
    <li className="rounded-xl border border-border p-4" data-testid="quiz-mistake">
      <div className="flex flex-wrap items-center gap-2">
        <PenLine className={cn("size-4", q.still ? "text-danger" : "text-faint")} />
        <span className="text-xs text-muted">{q.chapterName}</span>
        <Badge tone={q.still ? "danger" : "success"}>{q.still ? "Still to fix" : "Fixed"}</Badge>
        {q.sureMisses > 0 && <Badge tone="danger"><ShieldAlert className="size-3" /> Wrong while sure</Badge>}
        <span className="ml-auto text-xs text-muted">{q.subjectName}</span>
      </div>
      <p className="mt-2 font-medium" data-testid="quiz-mistake-question">{q.question}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <History history={q.history} bad="Not right" good="Right" /> Missed {q.misses} of {q.tries} tr{q.tries === 1 ? "y" : "ies"} · latest: {VERDICT_LABEL[q.latest]}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-danger-soft/60 px-3 py-2.5 text-sm">
          <p className="text-xs font-semibold text-danger">What you wrote{q.still ? "" : " before"} · {VERDICT_LABEL[q.lastWrong.verdict]}{q.lastWrong.confidence ? ` · you said “${CONFIDENCE_LABEL[q.lastWrong.confidence]}”` : ""}</p>
          <p className="mt-1 whitespace-pre-line">{q.lastWrong.answer.trim() || <span className="italic text-muted">(left blank)</span>}</p>
          {q.lastWrong.feedback && <p className="mt-1.5 text-xs text-muted" data-testid="quiz-mistake-feedback">{q.lastWrong.feedback}</p>}
        </div>
        <div className="rounded-lg bg-success-soft/60 px-3 py-2.5 text-sm">
          <p className="text-xs font-semibold text-success">Model answer</p>
          <p className="mt-1">{q.answer}</p>
          {q.keyPoints.length > 0 && <ul className="mt-1.5 list-inside list-disc text-xs text-muted">{q.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>}
        </div>
      </div>
      {q.still && (
        <Link href={`/classes/${classroomId}/study/${q.chapterId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Try a quiz on this chapter <ArrowRight className="size-4" />
        </Link>
      )}
    </li>
  );
}

function TrapCard({ t, classroomId }: { t: StudentTrap; classroomId: string }) {
  return (
    <li className="scroll-mt-24 rounded-xl border border-border p-4" data-testid="trap-row" id={`trap-${t.misconceptionId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Target className={cn("size-4", t.status === "ACTIVE" ? "text-danger" : "text-faint")} />
        <span className="font-medium">{t.label}</span>
        <Badge tone={TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
        {t.sureFalls > 0 && <Badge tone="danger"><ShieldAlert className="size-3" /> Fell for it while sure</Badge>}
        <span className="ml-auto text-xs text-muted">{t.subjectName}</span>
      </div>
      <p className="mt-2 text-sm" data-testid="trap-sentence">{trapSentence(t.label, t)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted"><History history={t.history} /> {trapProgress(t)}</p>
      {trapConfidenceNote(t) && <p className="mt-1 text-xs text-danger" data-testid="trap-confidence">{trapConfidenceNote(t)}</p>}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-primary">The right idea</summary>
        <p className="mt-1 text-muted">{t.fix}</p>
      </details>
      {t.status !== "CLEAR" && (
        <div className="mt-3">
          {t.practiceQuestions > 0 ? <TrapPractice classroomId={classroomId} misconceptionId={t.misconceptionId} label={t.label} />
            : <p className="text-xs text-muted">No practice questions for this trap yet. Ask your teacher.</p>}
        </div>
      )}
    </li>
  );
}

/** "How well do you know what you know": right answers at each confidence level, and what to do about it. */
function Calibration({ answered }: { answered: Answered[] }) {
  const c = calibration(answered);
  const advice = calibrationAdvice(c);
  return (
    <Collapsible defaultOpen icon={<Gauge className="size-5" />} title="How well you know what you know" data-testid="calibration"
      meta={c.rated ? `${c.rated} answer${c.rated === 1 ? "" : "s"} rated for confidence` : "Rate how sure you are when you answer"}>
      {c.rated < MIN_RATED ? (
        <p className="text-sm text-muted">After you answer a question, say how sure you are (Sure, Think so or Guessing). After {MIN_RATED} answers this shows whether your confidence matches your results{c.rated ? ` (${c.rated} so far)` : ""}.</p>
      ) : (
        <div className="space-y-3">
          <ul className="grid gap-2 sm:grid-cols-3">
            {CONFIDENCES.map((k) => {
              const p = percent(c[k].right, c[k].total);
              return (
                <li key={k} className="rounded-xl bg-surface-2 px-3 py-2.5" data-testid={`calibration-${k.toLowerCase()}`}>
                  <p className="text-xs text-muted">When you said “{CONFIDENCE_LABEL[k]}”</p>
                  <p className="text-xl font-semibold tabular-nums">{p === null ? "–" : `${p}%`} <span className="text-xs font-normal text-muted">right</span></p>
                  <p className="text-xs text-muted">{c[k].right} of {c[k].total} answers</p>
                </li>
              );
            })}
          </ul>
          {advice && <p className="text-sm" data-testid="calibration-advice">{advice.headline}{advice.tip && <> <strong>{advice.tip}</strong></>}</p>}
        </div>
      )}
    </Collapsible>
  );
}

async function StudentMap({ classroomId, userId }: { classroomId: string; userId: string }) {
  const { traps, quiz, graph, answered } = await studentMistakeMap(userId, classroomId);
  const trapInfo: Record<string, TrapInfo> = Object.fromEntries(traps.map((t) => [t.misconceptionId, { fix: t.fix, sentence: trapSentence(t.label, t), confidenceNote: trapConfidenceNote(t) }]));
  const hasTopics = graph.nodes.some((n) => n.kind === "topic");
  const working = traps.filter((t) => t.status === "ACTIVE" || t.status === "FADING");
  const done = traps.filter((t) => t.status === "FIXED" || t.status === "CLEAR");
  const count = (st: TrapStatus) => traps.filter((t) => t.status === st).length;
  const quizStill = quiz.filter((q) => q.still);
  const quizFixed = quiz.filter((q) => !q.still);
  if (traps.length === 0 && quiz.length === 0 && !hasTopics) {
    return <Card><EmptyState icon={<Target className="size-5" />} title="No mistakes yet" description="Practise multiple-choice questions and take written quizzes in Study. Only the mistakes you actually make show up here." /></Card>;
  }
  return (
    <div className="space-y-4" data-testid="student-mistakes">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Your Mistake Map</h2>
        <p className="text-sm text-muted">Your topics, the mistakes you&apos;ve made in practice and quizzes, and how sure you were. Only you can see this; your teacher sees class totals, never your name.</p>
      </div>

      {hasTopics && (
        <Collapsible defaultOpen icon={<Network className="size-5" />} title="Your topic map" data-testid="topic-map-section"
          meta="Each topic is a node, joined to its subject and to the traps you fell for in it">
          <TopicMap graph={graph} classroomId={classroomId} trapInfo={trapInfo} />
        </Collapsible>
      )}

      <Calibration answered={answered} />

      <Collapsible defaultOpen icon={<Target className="size-5" />} title="Multiple-choice traps" data-testid="mcq-mistakes"
        meta={traps.length ? `${count("ACTIVE")} active · ${count("FADING")} fading · ${count("FIXED")} fixed` : "None yet"}>
        {traps.length === 0 ? <p className="text-sm text-muted">No traps yet. Practise multiple-choice questions in Study; only the traps you fall for show up.</p> : (
          <div className="space-y-3">
            {working.length > 0 ? <ul className="space-y-2">{working.map((t) => <TrapCard key={t.misconceptionId} t={t} classroomId={classroomId} />)}</ul>
              : <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">No active traps right now. Keep practising to stay sharp.</p>}
            {done.length > 0 && (
              <Collapsible title="Fixed" meta={`${done.length} mistake${done.length === 1 ? "" : "s"} you've stopped making`}>
                <ul className="space-y-2">{done.map((t) => <TrapCard key={t.misconceptionId} t={t} classroomId={classroomId} />)}</ul>
              </Collapsible>
            )}
          </div>
        )}
      </Collapsible>

      <Collapsible defaultOpen icon={<PenLine className="size-5" />} title="Written quiz mistakes" data-testid="quiz-mistakes"
        meta={quiz.length ? `${quizStill.length} still to fix · ${quizFixed.length} fixed` : "None yet"}>
        {quiz.length === 0 ? <p className="text-sm text-muted">No written-quiz mistakes yet. Questions you don&apos;t get fully right in a quiz show up here with the model answer.</p> : (
          <div className="space-y-3">
            {quizStill.length > 0 ? <ul className="space-y-2">{quizStill.map((q) => <QuizMistakeCard key={q.questionId} q={q} classroomId={classroomId} />)}</ul>
              : <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">You&apos;ve fixed every quiz question you missed. Well done.</p>}
            {quizFixed.length > 0 && (
              <Collapsible title="Fixed" meta={`${quizFixed.length} question${quizFixed.length === 1 ? "" : "s"} you got right on a later try`}>
                <ul className="space-y-2">{quizFixed.map((q) => <QuizMistakeCard key={q.questionId} q={q} classroomId={classroomId} />)}</ul>
              </Collapsible>
            )}
          </div>
        )}
      </Collapsible>
    </div>
  );
}

/* ------------------------------------------------------------------ teachers */

function Stat({ label, value, testId }: { label: string; value: number | string; testId?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5" data-testid={testId}>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

async function TeacherMap({ classroomId }: { classroomId: string }) {
  const [{ rows, summary }, quiz] = await Promise.all([classMistakes([classroomId]), classQuizMistakes(classroomId)]);
  if (rows.length === 0 && quiz.rows.length === 0) {
    return (
      <Card><EmptyState icon={<Target className="size-5" />} title="No mistakes yet"
        description={summary.practising || quiz.quizzers
          ? "Students have practised and nobody has made a mistake yet."
          : "Once students practise multiple-choice questions and take written quizzes in Study, the mistakes they actually make appear here, organised by chapter."} /></Card>
    );
  }
  return (
    <div className="space-y-6" data-testid="teacher-mistakes">
      {rows.length > 0 ? <TeacherTraps classroomId={classroomId} rows={rows} summary={summary} />
        : <Card className="p-5 text-sm text-muted">No multiple-choice mistakes yet.</Card>}
      {quiz.rows.length > 0 ? <TeacherQuiz classroomId={classroomId} rows={quiz.rows} quizzers={quiz.quizzers} />
        : <Card className="p-5 text-sm text-muted" data-testid="class-quiz-empty">No written-quiz mistakes yet.</Card>}
    </div>
  );
}

function TeacherTraps({ classroomId, rows, summary }: { classroomId: string } & Awaited<ReturnType<typeof classMistakes>>) {
  const top = rows[0];
  const withPercent = rows.filter((r) => r.percent !== null);
  // Organise by chapter: the chapter with the most wrong picks first.
  const chapters = [...rows.reduce((m, r) => {
    const key = r.chapterId || r.chapterName;
    const g = m.get(key) ?? { name: r.chapterName, subject: r.subjectName, rows: [] as typeof rows, picks: 0 };
    g.rows.push(r);
    g.picks += r.falls;
    return m.set(key, g);
  }, new Map<string, { name: string; subject: string; rows: typeof rows; picks: number }>()).values()].sort((a, b) => b.picks - a.picks);

  return (
    <div className="space-y-4" data-testid="class-traps">
      <Card>
        <CardHeader icon={<Target className="size-5" />} title="What your class is getting wrong"
          description={`From multiple-choice practice: only mistakes students actually made, and how many were sure they were right. Counts only, never names; percentages from ${MIN_GROUP} students.`} />
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Students practising" value={summary.practising} testId="stat-practising" />
            <Stat label="Still making a mistake" value={summary.withActive} testId="stat-active" />
            <Stat label="Different mistakes" value={summary.mistakes} testId="stat-mistakes" />
            <Stat label="Wrong picks" value={summary.wrongPicks} testId="stat-picks" />
          </div>
          <p className="text-base" data-testid="top-trap">Most common: <strong>“{top.label}”</strong>. {classTrapSentence(top)}.</p>
          {withPercent.length > 0 && (
            <BarList caption="Share of students who fell for each trap" valueLabel="Students who fell for it"
              rows={withPercent.slice(0, 8).map((r) => ({ label: r.label, detail: r.active ? `${r.active} still do` : "none still do", value: r.percent! }))} />
          )}
        </div>
      </Card>

      <h2 className="px-1 text-sm font-semibold text-muted">Multiple-choice mistakes by chapter</h2>
      {chapters.map((g) => (
        <Collapsible key={g.name} defaultOpen title={g.name} data-testid="mistake-chapter"
          meta={`${g.subject} · ${g.rows.length} mistake${g.rows.length === 1 ? "" : "s"} · ${g.picks} wrong pick${g.picks === 1 ? "" : "s"}`} bodyClassName="px-0 pb-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_5rem_4rem_4rem_1.5rem] gap-2 border-y border-border px-5 py-2 text-xs font-medium text-muted sm:grid">
            <span>Mistake</span><span className="text-right">Fell for it</span><span className="text-right">Still do</span><span className="text-right">Fixed</span><span className="text-right">Picks</span><span />
          </div>
          <ul className="divide-y divide-border">
            {g.rows.map((r) => (
              <li key={r.misconceptionId} data-testid="class-trap-row">
                <details>
                  <summary className="grid cursor-pointer grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-2 px-5 py-3 text-sm hover:bg-surface-2/40 sm:grid-cols-[minmax(0,1fr)_6rem_5rem_4rem_4rem_1.5rem]">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium"><Target className="size-4 shrink-0 text-danger" /> {r.label}</span>
                      <span className="mt-0.5 block text-xs text-muted sm:hidden" data-testid="class-trap-sentence">{classTrapSentence(r)} · picked {r.falls} time{r.falls === 1 ? "" : "s"}</span>
                    </span>
                    <span className="hidden text-right tabular-nums sm:block">{r.fell} of {r.met}{r.percent !== null && <span className="text-xs text-muted"> ({r.percent}%)</span>}</span>
                    <span className={cn("hidden text-right tabular-nums sm:block", r.active > 0 && "font-semibold text-danger")}>{r.active}</span>
                    <span className="hidden text-right tabular-nums text-success sm:block">{r.fixed}</span>
                    <span className="hidden text-right tabular-nums sm:block">{r.falls}</span>
                    <Chevron className="size-4" />
                  </summary>
                  <div className="space-y-3 px-5 pb-4">
                    <p className="hidden text-xs text-muted sm:block" data-testid="class-trap-sentence">{classTrapSentence(r)} · picked {r.falls} time{r.falls === 1 ? "" : "s"}{r.fixed ? ` · ${r.fixed} fixed it` : ""}</p>
                    {r.sureFell > 0 && <p className="flex items-center gap-1.5 text-xs font-medium text-danger" data-testid="class-trap-sure"><ShieldAlert className="size-3.5" /> {r.sureFell} of the {r.fell} who fell for it {r.sureFell === 1 ? "was" : "were"} sure they were right: a firmly held wrong idea, worth teaching again.</p>}
                    {r.topPicks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted">Wrong answers they picked</p>
                        <ul className="mt-1 space-y-1.5" data-testid="top-picks">
                          {r.topPicks.map((p, i) => (
                            <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                              <p className="text-muted">{p.question}</p>
                              <p><span className="text-danger">Picked “{p.picked}”</span> <span className="text-xs text-muted">· {p.times} time{p.times === 1 ? "" : "s"}</span></p>
                              <p className="text-xs text-success">Right answer: {p.correct}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-sm"><span className="font-medium">The right idea:</span> <span className="text-muted">{r.fix}</span></p>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted">More practice on this:</span>
                      <MakeTrapQuestions classroomId={classroomId} misconceptionId={r.misconceptionId} label={r.label} />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Collapsible>
      ))}
      <p className="text-xs text-faint">Make more practice questions from a chapter&apos;s notes in <Link href={`/classes/${classroomId}/study`} className="underline">Study</Link>.</p>
    </div>
  );
}

/** Written questions the class gets wrong, by chapter. Counts only: no names, answers or feedback. */
function TeacherQuiz({ classroomId, rows, quizzers }: { classroomId: string; rows: ClassQuizRow[]; quizzers: number }) {
  const still = rows.reduce((n, r) => n + r.still, 0);
  const top = rows[0];
  const chapters = [...rows.reduce((m, r) => {
    const g = m.get(r.chapterId) ?? { id: r.chapterId, name: r.chapterName, subject: r.subjectName, position: r.chapterPosition, rows: [] as ClassQuizRow[], still: 0 };
    g.rows.push(r);
    g.still += r.still;
    return m.set(r.chapterId, g);
  }, new Map<string, { id: string; name: string; subject: string; position: number; rows: ClassQuizRow[]; still: number }>()).values()].sort((a, b) => b.still - a.still || a.position - b.position);
  return (
    <div className="space-y-4" data-testid="class-quiz">
      <Card>
        <CardHeader icon={<PenLine className="size-5" />} title="Written quiz questions the class gets wrong"
          description={`From written-answer quizzes in Study: questions not fully right. Counts only, never names or answers; percentages from ${MIN_GROUP} students.`} />
        <div className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Students taking quizzes" value={quizzers} testId="stat-quizzers" />
            <Stat label="Questions missed" value={rows.length} testId="stat-quiz-missed" />
            <Stat label="Still missing (students)" value={still} testId="stat-quiz-still" />
          </div>
          <p className="text-base" data-testid="top-quiz">Most missed: <strong>“{top.question}”</strong>. {classQuestionSentence(top)}.</p>
        </div>
      </Card>

      <h2 className="px-1 text-sm font-semibold text-muted">Written quiz mistakes by chapter</h2>
      {chapters.map((g) => (
        <Collapsible key={g.id} defaultOpen title={g.name} data-testid="quiz-chapter"
          meta={`${g.subject} · ${g.rows.length} question${g.rows.length === 1 ? "" : "s"} missed`} bodyClassName="px-0 pb-2">
          <ul className="divide-y divide-border">
            {g.rows.map((r) => (
              <li key={r.questionId} data-testid="class-quiz-row">
                <details>
                  <summary className="flex cursor-pointer items-start gap-3 px-5 py-3 text-sm hover:bg-surface-2/40">
                    <PenLine className="mt-0.5 size-4 shrink-0 text-danger" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{r.question}</span>
                      <span className="mt-0.5 block text-xs text-muted" data-testid="class-quiz-sentence">{classQuestionSentence(r)}{r.fixed ? ` · ${r.fixed} fixed it` : ""}{r.sureMissed ? ` · ${r.sureMissed} missed it while sure` : ""}</span>
                    </span>
                    <Chevron className="mt-0.5 size-4" />
                  </summary>
                  <div className="space-y-2 px-5 pb-4 pl-12 text-sm">
                    <p><span className="font-medium">Model answer:</span> <span className="text-muted">{r.answer}</span></p>
                    {r.keyPoints.length > 0 && <ul className="list-inside list-disc text-xs text-muted">{r.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>}
                    <Link href={`/classes/${classroomId}/study/${r.chapterId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Revise this in Study <ArrowRight className="size-4" /></Link>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </Collapsible>
      ))}
    </div>
  );
}
