"use client";

import { CheckCircle2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveAnswers } from "@/app/actions/homework";
import { MAX_HW_ANSWER, type HwMarks } from "@/lib/homework";
import { ReadAloud, VoiceInput } from "../speech";
import { useRunAction } from "../toast";
import { Alert, Badge, Button, Card, Textarea } from "../ui";

/** Student: answer a homework sheet (typed or spoken), save, and hand it in. Once marked, see the marks and comments. */
export function AnswerSheet({ sheetId, title, note, questions, answers, submitted, marks }: {
  sheetId: string; title: string; note: string; questions: { q: string; marks: number }[]; answers: string[]; submitted: boolean; marks: HwMarks | null;
}) {
  const router = useRouter();
  const runAction = useRunAction();
  const [a, setA] = useState(answers.length === questions.length ? answers : questions.map(() => ""));
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const outOf = questions.reduce((n, q) => n + q.marks, 0);
  const save = async (submit: boolean) => {
    setBusy(submit ? "submit" : "save");
    const r = await runAction(saveAnswers(sheetId, a, submit), submit ? "Handed in. Your teacher will mark it." : "Saved");
    setBusy(null);
    if (r.ok) router.refresh();
  };
  return (
    <Card className="space-y-4 p-5" data-testid="answer-sheet">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {marks ? <Badge tone="success">{marks.answers.reduce((n, x) => n + x.awarded, 0)} / {outOf}</Badge> : submitted ? <Badge>Handed in</Badge> : null}
        <ReadAloud text={questions.map((q, i) => `Question ${i + 1}. ${q.q}`).join(" ")} label="Read the questions" className="ml-auto" />
      </div>
      {note && <Alert tone="primary"><b>Instructions:</b> {note}</Alert>}
      {marks && <div className="rounded-xl bg-success-soft px-4 py-3 text-sm" data-testid="homework-feedback"><p className="flex items-center gap-1.5 font-medium text-success"><CheckCircle2 className="size-4" /> Marked by your teacher</p><p className="mt-1">{marks.feedback}</p>{marks.weak.length > 0 && <p className="mt-1 text-xs text-muted">Revise: {marks.weak.join(", ")}</p>}</div>}
      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={i} className="space-y-1.5" data-testid="homework-question">
            <p className="text-sm font-medium"><span className="mr-1 text-faint">{i + 1}.</span>{q.q} <span className="text-xs text-muted">[{q.marks}]</span></p>
            <Textarea value={a[i]} rows={3} maxLength={MAX_HW_ANSWER} disabled={!!marks} aria-label={`Answer ${i + 1}`} placeholder="Your answer" onChange={(e) => setA(a.map((x, k) => (k === i ? e.target.value : x)))} />
            {!marks && <VoiceInput onText={(t) => setA((v) => v.map((x, k) => (k === i ? `${x}${x ? " " : ""}${t}`.slice(0, MAX_HW_ANSWER) : x)))} />}
            {marks && <p className="text-xs"><b className="text-text">{marks.answers[i]?.awarded} / {q.marks}</b> <span className="text-muted">{marks.answers[i]?.comment}</span></p>}
          </li>
        ))}
      </ol>
      {!marks && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="secondary" loading={busy === "save"} disabled={!!busy} onClick={() => save(false)}>Save for later</Button>
          <Button loading={busy === "submit"} disabled={!!busy || a.every((x) => !x.trim())} onClick={() => save(true)} data-testid="hand-in"><Send className="size-4" /> {submitted ? "Hand in again" : "Hand in"}</Button>
        </div>
      )}
    </Card>
  );
}
