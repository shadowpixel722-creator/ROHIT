"use client";

import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { VoiceInput } from "../speech";
import Link from "next/link";
import { useState } from "react";
import { startQuiz, submitQuiz } from "@/app/actions/study";
import { CONFIDENCE_LABEL, type Confidence } from "@/lib/confidence";
import { levelOf, MAX_ANSWER_CHARS, VERDICT_LABEL, type QuizQuestionView, type QuizResult, type Verdict } from "@/lib/quiz";
import { ConfidencePicker, confidenceNote } from "./confidence-picker";
import { useRunAction } from "../toast";
import { Alert, Badge, Button, Chevron, cn, Textarea } from "../ui";
import { ReadinessBadge } from "./readiness-badge";

export type QuizNote = { id: string; title: string; date: string; questions: number };

type Phase =
  | { name: "choose" }
  | { name: "taking"; attemptId: string; questions: QuizQuestionView[]; answers: string[]; confidence: (Confidence | null)[]; noteIds: string[]; missing: boolean }
  | { name: "result"; result: QuizResult; noteIds: string[] };

const TONE: Record<Verdict, "success" | "warn" | "danger" | "neutral"> = { CORRECT: "success", PARTLY: "warn", INCORRECT: "danger", SKIPPED: "neutral" };
const points = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const messageFor = (percent: number) =>
  percent >= 80 ? "Great work. You know these notes well." : percent >= 50 ? "You're getting there. Review the notes below and try again." : "These notes need more practice. Read them again, then retry.";

/** "I've studied these notes": pick them, answer questions in your own words, see what to review. `blocked` explains why a quiz isn't available. */
export function QuizRunner({ classroomId, chapterId, notes, blocked }: { classroomId: string; chapterId: string; notes: QuizNote[]; blocked: string | null }) {
  const runAction = useRunAction();
  const usable = notes.filter((n) => n.questions > 0);
  const [phase, setPhase] = useState<Phase>({ name: "choose" });
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function begin(noteIds: string[]) {
    setBusy(true);
    const res = await runAction(startQuiz(chapterId, noteIds));
    setBusy(false);
    if (res.ok && res.data) {
      setPhase({ name: "taking", attemptId: res.data.attemptId, questions: res.data.questions, answers: res.data.questions.map(() => ""), confidence: res.data.questions.map(() => null), noteIds, missing: false });
      window.scrollTo({ top: 0 });
    }
  }

  async function finish(p: Extract<Phase, { name: "taking" }>) {
    // Every answer needs a confidence rating (blank ones don't): it's what makes the Mistake Map tell slips from real misconceptions.
    if (p.answers.some((a, i) => a.trim().length >= 2 && !p.confidence[i])) {
      setPhase({ ...p, missing: true });
      document.querySelector("[data-confidence-missing='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const blank = p.answers.filter((a) => a.trim().length < 2).length;
    if (blank > 0 && !confirm(`${blank} question${blank === 1 ? " is" : "s are"} left blank. Blank answers get no marks. Submit anyway?`)) return;
    setBusy(true);
    const res = await runAction(submitQuiz(p.attemptId, p.answers, p.answers.map((a, i) => (a.trim().length >= 2 ? p.confidence[i] : null)))); // if marking fails, the answers stay on screen to resend
    setBusy(false);
    if (res.ok && res.data) setPhase({ name: "result", result: res.data, noteIds: p.noteIds });
  }

  if (blocked) return <div data-testid="quiz-blocked"><Alert tone="warn">{blocked}</Alert></div>;
  if (usable.length === 0) return <p className="text-sm text-muted">No quiz questions yet. Your teacher hasn&apos;t published any for this chapter.</p>;

  if (phase.name === "choose") {
    return (
      <div className="space-y-3" data-testid="quiz-choose">
        <p className="text-sm text-muted">Tick the notes you&apos;ve studied. The quiz asks only about those.</p>
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Notes you have studied</legend>
          {notes.map((n) => (
            <label key={n.id} className={cn("flex items-start gap-2.5 rounded-xl border border-border px-3 py-2.5 text-sm", n.questions === 0 ? "opacity-50" : "cursor-pointer hover:bg-surface-2", picked.includes(n.id) && "border-primary/50 bg-primary-soft")}>
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" disabled={n.questions === 0} checked={picked.includes(n.id)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, n.id] : picked.filter((x) => x !== n.id))} />
              <span className="min-w-0 flex-1"><span className="block font-medium">{n.title}</span><span className="text-xs text-muted">{n.date} · {n.questions === 0 ? "no questions yet" : `${n.questions} question${n.questions === 1 ? "" : "s"}`}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button loading={busy} disabled={picked.length === 0} onClick={() => begin(picked)}>Start quiz</Button>
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setPicked(picked.length === usable.length ? [] : usable.map((n) => n.id))}>
            {picked.length === usable.length ? "Clear all" : "I've studied everything"}
          </button>
        </div>
      </div>
    );
  }

  if (phase.name === "taking") {
    const answered = phase.answers.filter((a) => a.trim().length >= 2).length;
    const unrated = phase.answers.filter((a, i) => a.trim().length >= 2 && !phase.confidence[i]).length;
    return (
      <div className="space-y-5" data-testid="quiz-taking">
        <Alert tone="primary">Use your own words; the idea matters, not exact wording. An AI checks answers, so don&apos;t write your name or phone number.</Alert>
        <p className="text-sm text-muted">{answered} of {phase.questions.length} answered · after each answer, say how sure you are</p>
        <ol className="space-y-5">
          {phase.questions.map((q, qi) => (
            <li key={q.id} className="space-y-2" data-testid="quiz-question">
              <label htmlFor={`ans-${q.id}`} className="block font-medium"><span className="mr-1.5 text-faint">{qi + 1}.</span>{q.question}</label>
              <Textarea id={`ans-${q.id}`} className="min-h-24" value={phase.answers[qi]} maxLength={MAX_ANSWER_CHARS} placeholder="Write your answer here…" disabled={busy}
                onChange={(e) => setPhase({ ...phase, answers: phase.answers.map((a, i) => (i === qi ? e.target.value : a)) })} />
              <VoiceInput onText={(t) => setPhase((p) => (p.name === "taking" ? { ...p, answers: p.answers.map((a, i) => (i === qi ? `${a}${a && !/\s$/.test(a) ? " " : ""}${t}`.slice(0, MAX_ANSWER_CHARS) : a)) } : p))} />
              {(() => {
                const needs = phase.missing && phase.answers[qi].trim().length >= 2 && !phase.confidence[qi];
                return (
                  <div data-confidence-missing={needs ? "true" : undefined}>
                    <ConfidencePicker name={`quiz-${q.id}`} compact disabled={busy} value={phase.confidence[qi]} error={needs}
                      label={needs ? "How sure are you of this answer? (choose one before submitting)" : "How sure are you of this answer?"}
                      onPick={(c) => setPhase({ ...phase, confidence: phase.confidence.map((x, i) => (i === qi ? c : x)) })} />
                  </div>
                );
              })()}
            </li>
          ))}
        </ol>
        {phase.missing && unrated > 0 && <Alert tone="warn">Say how sure you are for {unrated} more answer{unrated === 1 ? "" : "s"} (Sure, Think so or Guessing).</Alert>}
        <div className="flex flex-wrap items-center gap-2">
          <Button loading={busy} onClick={() => finish(phase)}>{busy ? "Checking your answers…" : "Submit answers"}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => setPhase({ name: "choose" })}>Stop without submitting</Button>
        </div>
      </div>
    );
  }

  const { result } = phase;
  const weak = result.notes.filter((n) => n.weak);
  return (
    <div className="space-y-5" data-testid="quiz-result">
      <div className="rounded-xl bg-surface-2 px-4 py-4">
        <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <span data-testid="quiz-score">{points(result.points)} / {result.total}</span> <ReadinessBadge percent={result.percent} level={levelOf(result.percent)} />
        </p>
        <p className="mt-1 text-sm text-muted">{messageFor(result.percent)}</p>
        <p className="mt-1 text-xs text-faint">Marked by AI, which can make mistakes. Partly correct = ½ mark.</p>
      </div>

      {result.notes.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold">By note</p>
          <ul className="space-y-1.5">
            {result.notes.map((n) => (
              <li key={n.noteId} className="flex flex-wrap items-center gap-2 text-sm">
                {n.weak ? <XCircle className="size-4 text-danger" /> : <CheckCircle2 className="size-4 text-success" />}
                <Link href={`/classes/${classroomId}/notebook/${n.noteId}`} className="font-medium hover:underline">{n.title}</Link>
                <span className="text-muted">{points(n.points)} of {n.total}</span>
                {n.weak && <Badge tone="danger">Review this</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {weak.length > 0 && <Button loading={busy} onClick={() => begin(weak.map((n) => n.noteId))}>Practise the weak notes</Button>}
        <Button variant="secondary" loading={busy} onClick={() => begin(phase.noteIds)}>Try new questions</Button>
        <Button variant="ghost" onClick={() => setPhase({ name: "choose" })}>Choose notes</Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Your answers</p>
        <ol className="space-y-3">
          {result.questions.map((q, i) => (
            <li key={i} className="rounded-xl border border-border text-sm" data-testid="quiz-review">
              <details open={q.verdict !== "CORRECT"}>
                <summary className="flex cursor-pointer items-start gap-2 p-3">
                  <span className="min-w-0 flex-1 font-medium"><span className="mr-1.5 text-faint">{i + 1}.</span>{q.question}</span>
                  <Badge tone={TONE[q.verdict]}>{q.verdict === "CORRECT" ? <CheckCircle2 className="size-3" /> : q.verdict === "SKIPPED" ? <CircleDashed className="size-3" /> : <XCircle className="size-3" />} {VERDICT_LABEL[q.verdict]}</Badge>
                  <Chevron className="size-4" />
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  <p className="rounded-lg bg-surface-2 px-2.5 py-2 text-muted">{q.answer.trim() ? q.answer : <em>No answer</em>}</p>
                  {q.confidence && <p className="text-xs text-muted">You said: <span className="font-medium text-text">{CONFIDENCE_LABEL[q.confidence]}</span></p>}
                  {q.feedback && <p>{q.feedback}</p>}
                  {(() => { const n = q.verdict === "SKIPPED" ? null : confidenceNote(q.verdict === "CORRECT", q.confidence); return n && <p className={cn("text-xs font-medium", n.tone === "danger" ? "text-danger" : "text-warn")} data-testid="quiz-confidence-note">{n.text}</p>; })()}
                  <p className="text-xs text-muted"><span className="font-medium text-text">Model answer:</span> {q.modelAnswer}</p>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
