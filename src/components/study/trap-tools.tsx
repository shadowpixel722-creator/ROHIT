"use client";

import { Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { generateTrapMcqs } from "@/app/actions/mistakes";
import { useRunAction } from "../toast";
import { Button } from "../ui";
import { McqRunner } from "./mcq-runner";

/** "Practise this trap": opens a short set of questions built around one misconception. */
export function TrapPractice({ classroomId, misconceptionId, label }: { classroomId: string; misconceptionId: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button size="sm" onClick={() => setOpen(true)} aria-label={`Practise the trap: ${label}`}><Target className="size-4" /> Practise this trap</Button>;
  return <div className="mt-2 w-full rounded-xl border border-border p-3"><McqRunner classroomId={classroomId} target={{ misconceptionId }} startLabel="Start" /></div>;
}

/** Teacher: ask the AI for a few more questions aimed at one misconception (saved as drafts to check). */
export function MakeTrapQuestions({ classroomId, misconceptionId, label }: { classroomId: string; misconceptionId: string; label: string }) {
  const runAction = useRunAction();
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ questions: number; chapterId: string } | null>(null);
  const [count, setCount] = useState(4);
  if (made) return <Link href={`/classes/${classroomId}/study/${made.chapterId}`} className="text-sm font-medium text-primary hover:underline">{made.questions} drafts made: check them →</Link>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label={`How many questions for: ${label}`}
        className="h-8 rounded-lg border border-border bg-surface px-2 text-sm">
        {[2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <Button size="sm" variant="secondary" loading={busy} aria-label={`Make questions for: ${label}`}
        onClick={async () => {
          setBusy(true);
          const res = await runAction(generateTrapMcqs(misconceptionId, count));
          setBusy(false);
          if (res.ok && res.data) setMade(res.data);
        }}><Sparkles className="size-3.5" /> Make more questions</Button>
    </span>
  );
}
