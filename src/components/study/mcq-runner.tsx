"use client";

import { CheckCircle2, Sparkles, Target, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerMcq, generateStudentMcqs, startMcqPractice, type McqView } from "@/app/actions/mistakes";
import type { Confidence } from "@/lib/confidence";
import { ConfidencePicker, confidenceNote } from "./confidence-picker";
import { useRunAction } from "../toast";
import { Badge, Button, cn } from "../ui";

type Feedback = { correct: boolean; correctPosition: number; explanation: string; trap: { id: string; label: string; fix: string } | null; confidence: Confidence | null };
type Run = { sessionId: string; questions: McqView[]; index: number; picked: number | null; feedback: Feedback | null; results: Feedback[] };

/**
 * Mistake Map practice: one question at a time with instant feedback. The student picks an option, then says
 * how sure they are (that confirms the answer). A wrong pick names the trap (the misconception behind that
 * option) and the correct idea. Nothing typed, nothing sent to AI.
 */
export function McqRunner({ classroomId, target, startLabel = "Start practice", generateCount = 0, generateOnly = false }: {
  classroomId: string; target: { chapterId: string } | { misconceptionId: string }; startLabel?: string;
  /** Students: how many new questions "Make new questions" asks for (the teacher's setting; 0 hides the button). */
  generateCount?: number;
  /** No approved questions yet: offer only "Make new questions". */
  generateOnly?: boolean;
}) {
  const runAction = useRunAction();
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [finished, setFinished] = useState<Feedback[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await runAction(startMcqPractice(target));
    setBusy(false);
    if (res.ok && res.data) { setFinished(null); setRun({ ...res.data, index: 0, picked: null, feedback: null, results: [] }); }
  }

  const chapterId = "chapterId" in target ? target.chapterId : null;
  async function generate() {
    if (!chapterId) return;
    setBusy(true);
    const res = await runAction(generateStudentMcqs(chapterId));
    setBusy(false);
    if (res.ok && res.data) { setFinished(null); setRun({ ...res.data, index: 0, picked: null, feedback: null, results: [] }); router.refresh(); }
  }
  const makeButton = chapterId && generateCount > 0 && (
    <Button variant="secondary" loading={busy} onClick={generate} data-testid="mcq-generate"><Sparkles className="size-4" /> Make {generateCount} new questions</Button>
  );

  /** Choosing an option only selects it; saying how sure you are confirms it. */
  function pick(choice: number) {
    if (!run || run.feedback || busy) return;
    setRun({ ...run, picked: choice });
  }

  async function confirm(confidence: Confidence) {
    if (!run || run.feedback || busy || run.picked === null) return;
    const choice = run.picked;
    setBusy(true);
    const res = await runAction(answerMcq(run.sessionId, run.index, choice, confidence));
    setBusy(false);
    if (res.ok && res.data) { const fb = { ...res.data, confidence }; setRun({ ...run, picked: choice, feedback: fb, results: [...run.results, fb] }); }
  }

  function next() {
    if (!run) return;
    if (run.index + 1 < run.questions.length) setRun({ ...run, index: run.index + 1, picked: null, feedback: null });
    else { setFinished(run.results); setRun(null); router.refresh(); } // the Mistake Map updates
  }

  if (finished) {
    const right = finished.filter((f) => f.correct).length;
    const traps = [...new Map(finished.filter((f) => f.trap).map((f) => [f.trap!.id, f.trap!])).values()];
    const sureWrong = finished.filter((f) => !f.correct && f.confidence === "SURE").length;
    const lucky = finished.filter((f) => f.correct && (f.confidence === "GUESS" || f.confidence === "UNSURE")).length;
    return (
      <div className="space-y-3" data-testid="mcq-done">
        <p className="text-lg font-semibold"><span data-testid="mcq-score">{right} / {finished.length}</span> right</p>
        {(sureWrong > 0 || lucky > 0) && (
          <p className="text-sm text-muted" data-testid="mcq-confidence-summary">
            {sureWrong > 0 && <span className="text-danger">Wrong while sure: {sureWrong}. </span>}
            {lucky > 0 && <span className="text-warn">Right but not sure: {lucky}. </span>}
            Both are on your Mistake Map.
          </p>
        )}
        {traps.length > 0 ? (
          <div className="space-y-1.5 text-sm">
            <p className="text-muted">Traps you fell for:</p>
            {traps.map((t) => <p key={t.id} className="flex items-center gap-2"><Target className="size-4 text-danger" /> {t.label}</p>)}
            <Link href={`/classes/${classroomId}/mistakes`} className="inline-block font-medium text-primary hover:underline">See your Mistake Map →</Link>
          </div>
        ) : <p className="text-sm text-muted">No traps this time. Well done!</p>}
        <div className="flex flex-wrap gap-2">
          {!generateOnly && <Button variant="secondary" loading={busy} onClick={start}>Practise again</Button>}
          {makeButton}
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {!generateOnly && <Button loading={busy} onClick={start} data-testid="mcq-start">{startLabel}</Button>}
          {makeButton}
        </div>
        {makeButton && <p className="text-xs text-muted">New questions are made by AI from this chapter&apos;s notes. You practise them now; your teacher checks them before they join everyone&apos;s practice.</p>}
      </div>
    );
  }

  const q = run.questions[run.index];
  const fb = run.feedback;
  return (
    <div className="space-y-3" data-testid="mcq-question">
      <p className="text-xs text-muted">Question {run.index + 1} of {run.questions.length}</p>
      <p className="font-medium">{q.stem}</p>
      <div className="space-y-1.5" role="group" aria-label="Choices">
        {q.choices.map((c, i) => {
          const isRight = fb && i === fb.correctPosition;
          const isWrongPick = fb && !fb.correct && i === run.picked;
          const isSelected = !fb && i === run.picked;
          return (
            <button key={i} type="button" disabled={!!fb || busy} onClick={() => pick(i)} aria-pressed={!fb ? isSelected : undefined}
              className={cn("flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                !fb && !isSelected && "border-border hover:bg-surface-2",
                isSelected && "border-primary bg-primary-soft font-medium",
                isRight && "border-success/50 bg-success-soft font-medium text-success",
                isWrongPick && "border-danger/50 bg-danger-soft text-danger",
                fb && !isRight && !isWrongPick && "border-border opacity-60")}>
              <span className="w-4 shrink-0 font-medium text-faint">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{c}</span>
              {isRight && <CheckCircle2 className="size-4 shrink-0" />}
              {isWrongPick && <XCircle className="size-4 shrink-0" />}
            </button>
          );
        })}
      </div>
      {!fb && run.picked !== null && (
        <ConfidencePicker name={`mcq-${run.index}`} label="How sure are you? (this checks your answer)" disabled={busy} onPick={confirm} />
      )}
      {!fb && run.picked === null && <p className="text-xs text-muted">Choose an answer, then say how sure you are.</p>}
      {fb && (
        <div className={cn("rounded-xl px-3.5 py-3 text-sm", fb.correct ? "bg-success-soft" : "bg-danger-soft")} data-testid="mcq-feedback">
          {fb.correct ? <p className="font-medium text-success">Right!</p> : fb.trap ? (
            <>
              <p className="font-medium text-danger">That&apos;s the trap: <Badge tone="danger">{fb.trap.label}</Badge></p>
              <p className="mt-1 text-text">{fb.trap.fix}</p>
            </>
          ) : <p className="font-medium text-danger">Not quite.</p>}
          {fb.explanation && <p className="mt-1 text-muted">{fb.explanation}</p>}
          {(() => { const n = confidenceNote(fb.correct, fb.confidence); return n && <p className={cn("mt-2 text-xs font-medium", n.tone === "danger" ? "text-danger" : "text-warn")} data-testid="mcq-confidence-note">{n.text}</p>; })()}
        </div>
      )}
      {fb && <Button onClick={next}>{run.index + 1 < run.questions.length ? "Next question" : "See results"}</Button>}
    </div>
  );
}
