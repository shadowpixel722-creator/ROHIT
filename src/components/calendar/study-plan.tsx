"use client";

import { BookOpen, CheckCircle2, ListChecks, SquareStack } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { togglePlanTask } from "@/app/actions/plan";
import type { PlanTask } from "@/lib/plan";
import { useRunAction } from "../toast";
import { Card, CardHeader, cn, ProgressBar } from "../ui";

type Exam = { id: string; title: string; subject: string; days: number; tasks: number; done: number };
type View = { catchUp: PlanTask[]; today: PlanTask[]; week: { day: string; tasks: PlanTask[] }[] };

/** The student's daily checklist for upcoming tests and exams, built from the chapters each one covers. */
export function StudyPlan({ classroomId, view, done, exams }: { classroomId: string; view: View; done: string[]; exams: Exam[] }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [ticked, setTicked] = useState(() => new Set(done));
  const base = `/classes/${classroomId}`;
  const toggle = async (key: string) => {
    const on = !ticked.has(key);
    setTicked((s) => { const n = new Set(s); if (on) n.add(key); else n.delete(key); return n; });
    const r = await runAction(togglePlanTask(classroomId, key, on));
    if (!r.ok) setTicked((s) => { const n = new Set(s); if (on) n.delete(key); else n.add(key); return n; });
    else router.refresh();
  };
  const examOf = (id: string) => exams.find((e) => e.id === id);
  const row = (t: PlanTask) => {
    const on = ticked.has(t.key), e = examOf(t.assessmentId);
    return (
      <li key={t.key} className={cn("flex items-start gap-3 py-2", on && "opacity-60")} data-testid="plan-task">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={on} onChange={() => toggle(t.key)} aria-label={`${t.kind === "study" ? "Study" : ""} ${t.label}`} />
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", on && "line-through")}>{t.kind === "study" ? <>Study: <b className="font-medium">{t.label}</b></> : t.label}</span>
          {e && <span className="block text-xs text-muted">For {e.title} ({e.subject})</span>}
        </span>
        {!on && t.chapterId && (
          <span className="flex shrink-0 gap-1">
            <Link href={`${base}/explain/${t.chapterId}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><BookOpen className="size-3.5" /> Learn</Link>
            <Link href={`${base}/study/${t.chapterId}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><ListChecks className="size-3.5" /> Practise</Link>
          </span>
        )}
        {!on && !t.chapterId && <Link href={`${base}/flashcards`} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"><SquareStack className="size-3.5" /> Flashcards</Link>}
      </li>
    );
  };
  const label = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
  return (
    <Card data-testid="study-plan">
      <CardHeader icon={<CheckCircle2 className="size-5" />} title="My study plan" description="A daily checklist for your upcoming tests and exams: one chapter at a time, then revision. Tick things off as you go." />
      <div className="space-y-4 px-5 pb-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {exams.map((e) => (
            <div key={e.id} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <p className="flex items-baseline justify-between gap-2 text-sm"><b className="truncate">{e.title}</b><span className="shrink-0 text-xs text-muted">{e.days === 0 ? "today" : `${e.days} day${e.days === 1 ? "" : "s"}`}</span></p>
              <ProgressBar value={e.tasks ? e.done / e.tasks : 0} className="mt-2" label={`${e.done} of ${e.tasks} tasks done`} />
              <p className="mt-1 text-xs text-muted">{e.done} of {e.tasks} tasks done</p>
            </div>
          ))}
        </div>
        {view.catchUp.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-warn">Catch up</p><ul className="divide-y divide-border">{view.catchUp.map(row)}</ul></div>}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Today</p>
          {view.today.length ? <ul className="divide-y divide-border" data-testid="plan-today">{view.today.map(row)}</ul> : <p className="py-2 text-sm text-muted">Nothing planned for today{view.catchUp.length ? " beyond catching up" : ". Enjoy the break, or revise a little"}.</p>}
        </div>
        {view.week.map((d) => <div key={d.day}><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label(d.day)}</p><ul className="divide-y divide-border">{d.tasks.map(row)}</ul></div>)}
      </div>
    </Card>
  );
}
