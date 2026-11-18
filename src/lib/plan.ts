/**
 * The student's study plan for an upcoming test or exam (from Knowa's planner): the chapters it covers
 * spread over the days from when it was set until the day before, then revision days, and a final check.
 * Deterministic (the same inputs give the same plan), so ticks stay put. Pure; unit-tested.
 */
import { addDays, daysBetween } from "./dates";

export type PlanTask = { key: string; day: string; kind: "study" | "revise" | "check"; label: string; chapterId: string | null; assessmentId: string };

export function planFor(a: { id: string; date: string; start: string; chapters: { id: string; name: string }[] }): PlanTask[] {
  const last = addDays(a.date, -1);
  const start = a.start <= last ? a.start : last;
  const n = Math.max(1, daysBetween(start, last) + 1);
  const rev = n >= 7 ? 2 : n >= 4 ? 1 : 0;
  const studyDays = Math.max(1, n - rev);
  const per = Math.max(1, Math.ceil(a.chapters.length / studyDays));
  const out: PlanTask[] = a.chapters.map((c, i) => ({
    key: `${a.id}:c${c.id}`, day: addDays(start, Math.min(studyDays - 1, Math.floor(i / per))), kind: "study", label: c.name, chapterId: c.id, assessmentId: a.id,
  }));
  for (let r = 0; r < rev; r++) out.push({ key: `${a.id}:r${r}`, day: addDays(start, studyDays + r), kind: r === rev - 1 ? "check" : "revise", label: r === rev - 1 ? "Final check: flashcards and a quick quiz" : "Revise all the chapters' notes", chapterId: null, assessmentId: a.id });
  if (rev === 0) out.push({ key: `${a.id}:r0`, day: last, kind: "check", label: "Final check: flashcards and a quick quiz", chapterId: null, assessmentId: a.id });
  return out;
}

/** Today's tasks (with any missed ones to catch up first) and the rest of the week, from several plans. */
export function planView(tasks: PlanTask[], done: Set<string>, today: string) {
  const catchUp = tasks.filter((t) => t.day < today && !done.has(t.key));
  const todays = tasks.filter((t) => t.day === today);
  const week = Array.from({ length: 6 }, (_, i) => addDays(today, i + 1)).map((d) => ({ day: d, tasks: tasks.filter((t) => t.day === d) })).filter((d) => d.tasks.length);
  return { catchUp, today: todays, week };
}
