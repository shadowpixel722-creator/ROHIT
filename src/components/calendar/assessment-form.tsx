"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createAssessment, deleteAssessment, updateAssessment } from "@/app/actions/study";
import { KIND_LABEL } from "@/lib/assessments";
import { useRunAction } from "../toast";
import { Button, cn, Field, Input, Select } from "../ui";

export type FormSubject = { id: string; name: string; chapters: { id: string; name: string }[] };
export type FormInitial = { kind: string; title: string; date: string; subjectId: string; chapterIds: string[]; patternId?: string | null };
/** An exam pattern the date can follow; choosing one ticks its lessons in this subject when none are ticked yet. */
export type FormPattern = { id: string; name: string; lessonIds: string[] };

/** Teachers only (the server checks too). Adds a test, assignment or exam, or edits one. */
export function AssessmentForm({ classroomId, subjects, patterns = [], today, assessmentId, initial, onDone }: {
  classroomId: string; subjects: FormSubject[]; patterns?: FormPattern[]; today: string; assessmentId?: string; initial?: FormInitial; onDone?: () => void;
}) {
  const runAction = useRunAction();
  const [kind, setKind] = useState(initial?.kind ?? "TEST");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? subjects[0]?.id ?? "");
  const [chapterIds, setChapterIds] = useState<string[]>(initial?.chapterIds ?? []);
  const [patternId, setPatternId] = useState(initial?.patternId ?? "");
  const [busy, setBusy] = useState(false);
  const chapters = subjects.find((s) => s.id === subjectId)?.chapters ?? [];

  if (subjects.length === 0) return <p className="text-sm text-muted">Add a subject and its chapters on the Overview tab first. A test covers chapters.</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input = { kind, title, date, subjectId, chapterIds, patternId };
    const res = assessmentId
      ? await runAction(updateAssessment(assessmentId, input), "Saved")
      : await runAction(createAssessment(classroomId, input), `${KIND_LABEL[kind as keyof typeof KIND_LABEL]} added to the calendar`);
    setBusy(false);
    if (res.ok) {
      if (!assessmentId) { setTitle(""); setDate(""); setChapterIds([]); setPatternId(""); }
      onDone?.();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="assessment-form">
      <div className="grid gap-3 sm:grid-cols-[150px_1fr_170px]">
        <Field label="Type" htmlFor={`kind-${assessmentId ?? "new"}`}>
          <Select id={`kind-${assessmentId ?? "new"}`} value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Title" htmlFor={`title-${assessmentId ?? "new"}`}>
          <Input id={`title-${assessmentId ?? "new"}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Unit 2 test" required />
        </Field>
        <Field label="Date" htmlFor={`date-${assessmentId ?? "new"}`}>
          <Input id={`date-${assessmentId ?? "new"}`} type="date" value={date} min={assessmentId ? undefined : today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <Field label="Subject" htmlFor={`subject-${assessmentId ?? "new"}`}>
        <Select id={`subject-${assessmentId ?? "new"}`} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterIds([]); }}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>
      {patterns.length > 0 && (
        <Field label="Exam pattern" htmlFor={`pattern-${assessmentId ?? "new"}`} optional hint="Students can open the pattern from the calendar. Its lessons are ticked below if none are yet.">
          <Select id={`pattern-${assessmentId ?? "new"}`} value={patternId} onChange={(e) => {
            setPatternId(e.target.value);
            const lessons = patterns.find((p) => p.id === e.target.value)?.lessonIds ?? [];
            if (chapterIds.length === 0) setChapterIds(chapters.filter((c) => lessons.includes(c.id)).map((c) => c.id));
          }}>
            <option value="">None</option>
            {patterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      )}
      <fieldset>
        <legend className="mb-1.5 flex items-center gap-3 text-sm font-medium">
          Chapters it covers
          {chapters.length > 0 && (
            <button type="button" className="text-xs font-normal text-primary hover:underline" onClick={() => setChapterIds(chapterIds.length === chapters.length ? [] : chapters.map((c) => c.id))}>
              {chapterIds.length === chapters.length ? "Clear all" : "Select all"}
            </button>
          )}
        </legend>
        {chapters.length === 0 ? <p className="text-sm text-muted">This subject has no chapters yet.</p> : (
          <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-2">
            {chapters.map((c) => (
              <label key={c.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", chapterIds.includes(c.id) && "bg-primary-soft")}>
                <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" checked={chapterIds.includes(c.id)}
                  onChange={(e) => setChapterIds(e.target.checked ? [...chapterIds, c.id] : chapterIds.filter((x) => x !== c.id))} />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex gap-2">
        <Button type="submit" loading={busy} disabled={!title.trim() || !date || chapterIds.length === 0}>
          {assessmentId ? "Save changes" : <><Plus className="size-4" /> Add to calendar</>}
        </Button>
        {assessmentId && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

/** Edit and delete for one date (teachers only). */
export function AssessmentActions({ classroomId, subjects, patterns, today, assessmentId, initial }: {
  classroomId: string; subjects: FormSubject[]; patterns?: FormPattern[]; today: string; assessmentId: string; initial: FormInitial;
}) {
  const runAction = useRunAction();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="mt-3 w-full rounded-xl border border-border bg-surface-2/40 p-4">
        <AssessmentForm classroomId={classroomId} subjects={subjects} patterns={patterns} today={today} assessmentId={assessmentId} initial={initial} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      <Button size="sm" variant="secondary" aria-label={`Edit ${initial.title}`} onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit</Button>
      <Button size="sm" variant="ghost" aria-label={`Delete ${initial.title}`}
        onClick={() => confirm(`Delete “${initial.title}” from the calendar? Students will no longer see it.`) && runAction(deleteAssessment(assessmentId), "Deleted")}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
