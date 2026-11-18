"use client";

import { FileText, Paperclip, Plus, Printer, Save, Trash2, Wand2, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { addPatternAttachments, deletePattern, readPastedPattern, removePatternAttachment, savePattern } from "@/app/actions/exam-patterns";
import { ATTACHMENT_ACCEPT, ATTACHMENT_KINDS, extOf, formatBytes, kindLabel, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/attachment-check";
import { PRESETS, QUESTION_TYPES, totalMarks, totalQuestions, type Pattern, type QuestionType } from "@/lib/exam-schema";
import { useRunAction, useToast } from "../toast";
import { Alert, Button, cn, Field, Input, Textarea } from "../ui";

export type LessonSubject = { id: string; name: string; chapters: { id: string; name: string; notes: number }[] };
export type PatternFile = { id: string; fileName: string; size: number };

const blank: Pattern = { name: "", durationMinutes: 60, instructions: "", sections: [{ name: "Section A", type: "mcq", count: 10, marks: 1, note: "" }] };

/**
 * Build or edit an exam pattern: the lessons it covers (only lessons with approved notes), and its sections
 * from a preset, from a pasted description (read by AI), or by hand.
 */
export function PatternEditor({ classroomId, patternId, initial, initialLessons = [], files = [], subjects, onDone, aiOn }: {
  classroomId: string; patternId?: string; initial?: Pattern; initialLessons?: string[]; files?: PatternFile[]; subjects: LessonSubject[]; onDone?: () => void; aiOn: boolean;
}) {
  const runAction = useRunAction();
  const toast = useToast();
  const [p, setP] = useState<Pattern>(initial ?? blank);
  const [lessons, setLessons] = useState<string[]>(initialLessons);
  const [pasted, setPasted] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]); // a new pattern's files, uploaded once it is saved
  const total = totalMarks(p.sections);
  const setSection = (i: number, patch: Partial<Pattern["sections"][number]>) => setP({ ...p, sections: p.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const nextName = () => `Section ${String.fromCharCode(65 + p.sections.length)}`;

  async function read() {
    setReading(true);
    setWarning(null);
    const res = await runAction(readPastedPattern(classroomId, pasted));
    setReading(false);
    if (res.ok && res.data) {
      const { statedMarks, ...pattern } = res.data;
      setP(pattern);
      const sum = totalMarks(pattern.sections);
      if (statedMarks !== null && statedMarks !== sum) setWarning(`Your pattern says ${statedMarks} marks, but its sections add up to ${sum}. Check the counts and marks below.`);
      toast("Pattern read. Check it below, then save.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(savePattern(classroomId, patternId ?? null, p, lessons), patternId ? "Pattern saved" : "Pattern added");
    if (res.ok && res.data && !patternId && pending.length) {
      const form = new FormData();
      pending.forEach((f) => form.append("attachments", f));
      await runAction(addPatternAttachments(res.data.id, form), `${pending.length} file${pending.length === 1 ? "" : "s"} attached`);
    }
    setBusy(false);
    if (res.ok) { if (!patternId) { setP(blank); setLessons([]); setPending([]); setPasted(""); setWarning(null); } onDone?.(); }
  }

  return (
    <form onSubmit={save} className="space-y-4" data-testid="pattern-editor">
      {!patternId && (
        <div className="space-y-3 rounded-xl bg-surface-2/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Start from:</span>
            {PRESETS.map((pre) => <Button key={pre.name} size="sm" variant="secondary" onClick={() => { setP(structuredClone(pre)); setWarning(null); }}>{pre.name}</Button>)}
          </div>
          {aiOn && (
            <div className="space-y-2">
              <Field label="Or paste your school's pattern" htmlFor="pasted-pattern" hint="E.g. “Section A: 20 MCQs of 1 mark. Section B: 6 questions of 2 marks…”. The AI turns it into sections you can check.">
                <GrowingTextarea id="pasted-pattern" data-testid="pasted-pattern" className="min-h-28" value={pasted} onChange={(e) => setPasted(e.target.value)} maxLength={4000} />
              </Field>
              <Button size="sm" variant="secondary" loading={reading} disabled={pasted.trim().length < 15} onClick={read}><Wand2 className="size-4" /> Read pattern</Button>
            </div>
          )}
        </div>
      )}
      {warning && <Alert tone="warn">{warning}</Alert>}

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
        <Field label="Pattern name" htmlFor={`pn-${patternId ?? "new"}`}><Input id={`pn-${patternId ?? "new"}`} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={80} placeholder="e.g. Half-yearly exam" required /></Field>
        <Field label="Time (minutes)" htmlFor={`pd-${patternId ?? "new"}`}><Input id={`pd-${patternId ?? "new"}`} type="number" min={10} max={300} value={p.durationMinutes} onChange={(e) => setP({ ...p, durationMinutes: Number(e.target.value) })} required /></Field>
      </div>

      <LessonPicker subjects={subjects} value={lessons} onChange={setLessons} />

      <div>
        <p className="mb-1.5 text-sm font-medium">Sections</p>
        <ul className="space-y-2">
          {p.sections.map((s, i) => (
            <li key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-[7rem_minmax(0,1fr)_5rem_5rem_2rem]" data-testid="pattern-section">
              <Input aria-label={`Section ${i + 1} name`} value={s.name} onChange={(e) => setSection(i, { name: e.target.value })} maxLength={60} className="h-9" />
              <select aria-label={`Section ${i + 1} question type`} value={s.type} onChange={(e) => setSection(i, { type: e.target.value as QuestionType })} className="h-9 rounded-xl border border-border bg-surface px-2 text-sm">
                {Object.entries(QUESTION_TYPES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-xs text-muted">×<Input aria-label={`Section ${i + 1} number of questions`} type="number" min={1} max={40} value={s.count} onChange={(e) => setSection(i, { count: Number(e.target.value) })} className="h-9" /></label>
              <label className="flex items-center gap-1 text-xs text-muted"><Input aria-label={`Section ${i + 1} marks each`} type="number" min={0.5} max={20} step={0.5} value={s.marks} onChange={(e) => setSection(i, { marks: Number(e.target.value) })} className="h-9" />m</label>
              <button type="button" disabled={p.sections.length === 1} onClick={() => setP({ ...p, sections: p.sections.filter((_, j) => j !== i) })}
                className="grid size-9 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-danger disabled:opacity-30" aria-label={`Remove section ${i + 1}`}><Trash2 className="size-4" /></button>
              <Input aria-label={`Section ${i + 1} note`} value={s.note} onChange={(e) => setSection(i, { note: e.target.value })} maxLength={200} placeholder="Note for this section (optional), e.g. Answer in 40–60 words" className="col-span-2 h-9 sm:col-span-5" />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {p.sections.length < 10 && <Button size="sm" variant="ghost" onClick={() => setP({ ...p, sections: [...p.sections, { name: nextName(), type: "short", count: 3, marks: 3, note: "" }] })}><Plus className="size-4" /> Add section</Button>}
          <p className="text-sm font-medium" data-testid="pattern-total">{totalQuestions(p.sections)} questions · {total} marks · {p.durationMinutes} min</p>
        </div>
      </div>

      <Field label="General instructions" htmlFor={`pi-${patternId ?? "new"}`} optional>
        <GrowingTextarea id={`pi-${patternId ?? "new"}`} className="min-h-16" value={p.instructions} onChange={(e) => setP({ ...p, instructions: e.target.value })} maxLength={1000} placeholder="Printed at the top of every paper" />
      </Field>

      <PatternFiles patternId={patternId} saved={files} pending={pending} setPending={setPending} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} disabled={!p.name.trim() || lessons.length === 0}><Save className="size-4" /> Save pattern</Button>
        {onDone && patternId && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
        {patternId && <Button variant="ghost" className="ml-auto text-danger" onClick={async () => { if (confirm(`Delete the pattern “${p.name}”? Papers already made from it are kept.`)) await runAction(deletePattern(patternId), "Pattern deleted"); }}><Trash2 className="size-4" /> Delete</Button>}
      </div>
    </form>
  );
}

/** Lessons in this exam, grouped by subject. Only lessons with approved notes are offered. */
function LessonPicker({ subjects, value, onChange }: { subjects: LessonSubject[]; value: string[]; onChange: (ids: string[]) => void }) {
  const withNotes = subjects.map((s) => ({ ...s, chapters: s.chapters.filter((c) => c.notes > 0) })).filter((s) => s.chapters.length > 0);
  const toggle = (ids: string[], on: boolean) => onChange(on ? [...new Set([...value, ...ids])] : value.filter((x) => !ids.includes(x)));
  return (
    <fieldset data-testid="lesson-picker">
      <legend className="mb-1.5 text-sm font-medium">Lessons in this exam <span className="font-normal text-muted">({value.length} chosen)</span></legend>
      {withNotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted">No lessons have approved notes yet. Add notes to the Notebook first, then choose the lessons here.</p>
      ) : (
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border p-2.5">
          {withNotes.map((s) => {
            const ids = s.chapters.map((c) => c.id);
            const all = ids.every((id) => value.includes(id));
            return (
              <div key={s.id}>
                <div className="mb-1 flex items-center gap-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  {s.name}
                  <button type="button" className="font-normal normal-case tracking-normal text-primary hover:underline" onClick={() => toggle(ids, !all)}>{all ? "Clear" : "Select all"}</button>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {s.chapters.map((c) => (
                    <label key={c.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", value.includes(c.id) && "bg-primary-soft")}>
                      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" checked={value.includes(c.id)} onChange={(e) => toggle([c.id], e.target.checked)} />
                      <span>{c.name} <span className="text-xs text-muted">· {c.notes} note{c.notes === 1 ? "" : "s"}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

export function PrintButton() {
  return <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="size-4" /> Print / PDF</Button>;
}

/**
 * Files on a pattern (e.g. the school's circular or a past paper). On a saved pattern they upload and delete
 * straight away; on a new one they wait in `pending` until the pattern is saved.
 */
function PatternFiles({ patternId, saved, pending, setPending }: { patternId?: string; saved: PatternFile[]; pending: File[]; setPending: (f: File[]) => void }) {
  const runAction = useRunAction();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const count = saved.length + pending.length;

  async function choose(list: FileList) {
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!ATTACHMENT_ACCEPT.split(",").includes(`.${extOf(f.name)}`)) { toast(`“${f.name}” can't be attached. Use ${ATTACHMENT_KINDS}.`, "error"); continue; }
      if (f.size > MAX_ATTACHMENT_BYTES) { toast(`“${f.name}” is larger than 10 MB.`, "error"); continue; }
      if (count + ok.length >= MAX_ATTACHMENTS) { toast(`A pattern can have up to ${MAX_ATTACHMENTS} attachments.`, "error"); break; }
      ok.push(f);
    }
    if (!ok.length) return;
    if (!patternId) return setPending([...pending, ...ok]);
    const form = new FormData();
    ok.forEach((f) => form.append("attachments", f));
    setUploading(true);
    await runAction(addPatternAttachments(patternId, form), `${ok.length} file${ok.length === 1 ? "" : "s"} attached`);
    setUploading(false);
  }

  return (
    <div className="space-y-2" data-testid="pattern-files">
      <p className="flex items-baseline justify-between text-sm font-medium">
        <span className="flex items-center gap-1.5"><Paperclip className="size-4 text-primary" /> Attachments <span className="font-normal text-muted">(optional)</span></span>
        <span className="text-xs font-normal text-muted">{count}/{MAX_ATTACHMENTS}</span>
      </p>
      {count > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border" data-testid="pattern-file-list">
          {saved.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted" />
              <a href={`/api/pattern-files/${f.id}`} download className="min-w-0 flex-1 truncate hover:underline">{f.fileName}</a>
              <span className="text-xs text-muted">{kindLabel(f.fileName)} · {formatBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.fileName}`} className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger"
                onClick={async () => { if (confirm(`Remove “${f.fileName}”?`)) await runAction(removePatternAttachment(f.id), "File removed"); }}><X className="size-4" /></button>
            </li>
          ))}
          {pending.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted">{kindLabel(f.name)} · {formatBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger"
                onClick={() => setPending(pending.filter((_, j) => j !== i))}><X className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {count < MAX_ATTACHMENTS && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" loading={uploading} onClick={() => input.current?.click()}><Paperclip className="size-4" /> Attach files</Button>
          <span className="text-xs text-faint">E.g. the school&apos;s circular or a past paper. {ATTACHMENT_KINDS}, 10 MB each. The class can download them.</span>
          <input ref={input} type="file" accept={ATTACHMENT_ACCEPT} multiple className="sr-only" aria-label="Choose files to attach to the pattern"
            onChange={(e) => { if (e.target.files) choose(e.target.files); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}

/**
 * A text box that grows with what's typed or pasted (up to 60% of the screen, then it scrolls), and can also be
 * dragged taller or shorter with its corner handle.
 */
function GrowingTextarea(props: React.ComponentProps<typeof Textarea>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const userHeight = useRef(0); // a height the teacher dragged to is kept as the minimum
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(Math.min(el.scrollHeight + 2, window.innerHeight * 0.6), userHeight.current)}px`;
  }, [props.value]);
  return (
    <Textarea ref={ref} {...props} className={cn("resize-y overflow-y-auto", props.className)}
      onPointerUp={(e) => { userHeight.current = e.currentTarget.offsetHeight; }} />
  );
}
