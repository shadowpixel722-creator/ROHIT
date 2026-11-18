"use client";

import { Check, RefreshCw, Sparkles, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { approveChapterMcqs, approveMcq, deleteMcq, generateNoteMcqs, setStudentQuestionCount } from "@/app/actions/mistakes";
import { CountPicker } from "./study-manager";
import { useRunAction, useToast } from "../toast";
import { Alert, Badge, Button, cn } from "../ui";

export type McqNote = { id: string; title: string; enoughText: boolean; mcqs: number };
export type ManagerMcq = { id: string; stem: string; choices: string[]; answerIndex: number; explanation: string; tags: (string | null)[]; draft: boolean; noteTitle: string | null; byStudent: boolean; madeByStudent: boolean };

/** Teacher tools for Mistake Map questions: make them from approved notes, check each trap, approve. */
export function McqManager({ classroomId, chapterId, notes, mcqs, aiOn, studentCount }: { classroomId: string; chapterId: string; notes: McqNote[]; mcqs: ManagerMcq[]; aiOn: boolean; studentCount: number }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [busyNote, setBusyNote] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [count, setCount] = useState(0); // per note; 0 = Auto
  const [perStudent, setPerStudent] = useState(studentCount);
  const drafts = mcqs.filter((q) => q.draft).length;
  const pending = notes.filter((n) => n.mcqs === 0 && n.enoughText);

  async function one(n: McqNote, replace: boolean) {
    if (replace && !confirm("Replace the AI-made multiple-choice questions for this note? Students' past answers to them are removed too.")) return false;
    setBusyNote(n.id);
    const res = await runAction(generateNoteMcqs(n.id, replace, count || undefined));
    setBusyNote(null);
    return res.ok;
  }

  async function all() {
    setProgress({ done: 0, total: pending.length });
    let ok = 0;
    for (const [i, n] of pending.entries()) {
      if (await one(n, false)) ok++;
      setProgress({ done: i + 1, total: pending.length });
    }
    setProgress(null);
    if (ok) toast(`Made questions for ${ok} note${ok === 1 ? "" : "s"}. Check them, then approve.`);
  }

  return (
    <div className="space-y-4">
      {!aiOn && <Alert tone="warn">AI is off, so no questions can be made.</Alert>}
      <p className="text-sm text-muted">Every wrong option is tagged with the misconception behind it. Students&apos; picks build the Mistake Map.</p>
      {aiOn && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="mcq-counts">
          <CountPicker label="Questions per note" value={count} onChange={setCount} />
          <label htmlFor="student-count" className="flex items-center gap-2 text-sm text-muted">
            Students can make new questions
            <select id="student-count" value={perStudent} className="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-text"
              onChange={async (e) => {
                const n = Number(e.target.value);
                const before = perStudent;
                setPerStudent(n);
                const res = await runAction(setStudentQuestionCount(classroomId, n), n ? `Students get ${n} new questions at a time` : "Students can no longer make new questions");
                if (!res.ok) setPerStudent(before);
              }}>
              <option value={0}>Off</option>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} at a time</option>)}
            </select>
          </label>
        </div>
      )}
      {notes.length === 0 ? <p className="text-sm text-muted">No approved notes in this chapter yet.</p> : (
        <>
          {aiOn && pending.length > 0 && (
            <Button size="sm" onClick={all} loading={!!progress} data-testid="mcq-generate-all">
              <Sparkles className="size-4" /> {progress ? `Making ${progress.done + 1} of ${progress.total}…` : `Make questions for ${pending.length} note${pending.length === 1 ? "" : "s"}`}
            </Button>
          )}
          <ul className="divide-y divide-border rounded-xl border border-border">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{n.title} <span className="text-xs text-muted">· {n.mcqs} question{n.mcqs === 1 ? "" : "s"}</span></span>
                {aiOn && (
                  <Button size="sm" variant="secondary" loading={busyNote === n.id} disabled={!n.enoughText && n.mcqs === 0} onClick={() => one(n, n.mcqs > 0)}>
                    {n.mcqs > 0 ? <><RefreshCw className="size-3.5" /> Regenerate</> : <><Sparkles className="size-3.5" /> Generate</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {drafts > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" data-testid="mcq-drafts">
          <span><strong>{drafts}</strong> question{drafts === 1 ? "" : "s"} to check. Students can&apos;t see drafts.</span>
          <Button size="sm" onClick={() => runAction(approveChapterMcqs(chapterId), "Approved. Students can practise them now")}><Check className="size-4" /> Approve all</Button>
        </div>
      )}

      {mcqs.length > 0 && (
        <ul className="space-y-2">
          {mcqs.map((q) => (
            <li key={q.id} className="rounded-xl border border-border p-3" data-testid="mcq-row">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                {q.draft ? <Badge tone="warn">Draft</Badge> : <Badge tone="success">Approved</Badge>}
                {q.madeByStudent && <Badge>Made by a student</Badge>}
                {q.byStudent && <Badge tone="primary">Approved by a student</Badge>}
                {q.noteTitle && <span className="truncate text-xs text-muted">from “{q.noteTitle}”</span>}
                <span className="ml-auto flex gap-1">
                  {q.draft && <Button size="sm" onClick={() => runAction(approveMcq(q.id), "Approved")} aria-label="Approve question"><Check className="size-3.5" /></Button>}
                  <Button size="sm" variant="ghost" onClick={() => confirm("Delete this question? Students' answers to it are removed from their Mistake Map.") && runAction(deleteMcq(q.id), "Deleted")} aria-label="Delete question"><Trash2 className="size-4" /></Button>
                </span>
              </div>
              <p className="text-sm font-medium">{q.stem}</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {q.choices.map((c, i) => (
                  <li key={i} className={cn("flex flex-wrap items-center gap-x-2", i === q.answerIndex ? "font-medium text-success" : "text-muted")}>
                    <span>{String.fromCharCode(65 + i)}. {c}{i === q.answerIndex && " ✓"}</span>
                    {q.tags[i] && <span className="inline-flex items-center gap-1 text-xs text-danger"><Target className="size-3" /> {q.tags[i]}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
