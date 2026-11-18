"use client";

import { ArrowDown, ArrowUp, BookMarked, ChevronDown, ListPlus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addChapters, addSubject, deleteChapter, deleteSubject, loadNcertChapters, moveChapter, renameChapter, updateSubject } from "@/app/actions/syllabus";
import { COMMON_SUBJECTS, SUBJECT_COLORS } from "@/lib/constants";
import { useRunAction, useToast } from "../toast";
import { Button, Card, cn, EmptyState, Input, Textarea } from "../ui";

export type EditorSubject = { id: string; name: string; color: string; indexSource: string | null; ncertAvailable: boolean; chapters: { id: string; name: string; ncert: boolean; notes: number; items: number }[] };

/** Says exactly what deleting a chapter does, so nothing is lost by surprise. */
function deleteWarning(c: EditorSubject["chapters"][number]) {
  const lines = [`Delete the chapter “${c.name}”?`];
  if (c.notes) lines.push(`Its ${c.notes} note${c.notes === 1 ? "" : "s"} stay in the notebook, filed with no chapter.`);
  if (c.items) lines.push(`Its ${c.items} flashcard${c.items === 1 ? "" : "s"} and quiz question${c.items === 1 ? "" : "s"}, and students' quiz results for it, will be deleted.`);
  if (c.ncert) lines.push(`It's an NCERT chapter: “Add missing NCERT chapters” can bring it back (empty).`);
  return lines.join("\n\n");
}

function ChapterRow({ c, index, total }: { c: EditorSubject["chapters"][number]; index: number; total: number }) {
  const runAction = useRunAction();
  const [name, setName] = useState(c.name);
  async function save() {
    const v = name.trim();
    if (v === c.name) return;
    if (!v) return setName(c.name);
    const res = await runAction(renameChapter(c.id, v));
    if (!res.ok) setName(c.name);
  }
  return (
    <li className="flex items-center gap-2 py-1.5" data-testid={c.ncert ? "ncert-chapter" : "chapter"}>
      <span className="w-6 shrink-0 text-center text-xs text-faint">{index + 1}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} maxLength={160}
        aria-label="Chapter name" className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm hover:border-border focus:border-primary focus:outline-none" />
      {c.ncert && <span className="shrink-0 rounded bg-primary-soft px-1.5 text-[10px] font-medium text-primary" data-testid="ncert-tag">NCERT</span>}
      <button onClick={() => runAction(moveChapter(c.id, "up"))} disabled={index === 0} className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30" aria-label={`Move ${c.name} up`}><ArrowUp className="size-3.5" /></button>
      <button onClick={() => runAction(moveChapter(c.id, "down"))} disabled={index === total - 1} className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-text disabled:opacity-30" aria-label={`Move ${c.name} down`}><ArrowDown className="size-3.5" /></button>
      <button onClick={() => confirm(deleteWarning(c)) && runAction(deleteChapter(c.id), `Deleted “${c.name}”`)} className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger" aria-label={`Delete chapter ${c.name}`}><Trash2 className="size-3.5" /></button>
    </li>
  );
}

function SubjectBlock({ s, defaultOpen }: { s: EditorSubject; defaultOpen: boolean }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState(s.name);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function rename() {
    const v = name.trim();
    if (v === s.name) return;
    if (!v) return setName(s.name);
    const res = await runAction(updateSubject(s.id, { name: v }));
    if (!res.ok) setName(s.name);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(addChapters(s.id, text));
    setBusy(false);
    if (res.ok && res.data) {
      setText("");
      toast(`Added ${res.data.added} chapter${res.data.added === 1 ? "" : "s"}${res.data.skipped ? ` (${res.data.skipped} already existed)` : ""}`);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="size-3 shrink-0 rounded-full" style={{ background: SUBJECT_COLORS[s.color] }} />
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} maxLength={60}
          aria-label="Subject name" className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium hover:border-border focus:border-primary focus:outline-none" />
        <span className="hidden text-xs text-muted sm:inline">{s.chapters.length} chapters</span>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${s.name}`}>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </Button>
        <Button variant="ghost" size="sm" aria-label={`Delete ${s.name}`}
          onClick={() => confirm(`Delete “${s.name}” and its ${s.chapters.length} chapters? This affects the whole class.`) && runAction(deleteSubject(s.id), `Deleted ${s.name}`)}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-border px-4 py-4">
          {(s.indexSource || s.ncertAvailable) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2 text-xs text-primary" data-testid="index-source">
              <span className="inline-flex items-center gap-1.5"><BookMarked className="size-3.5" />
                {s.indexSource ? `Chapters from ${s.indexSource}` : "An NCERT chapter list is available for this subject."}</span>
              {s.ncertAvailable && (
                <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
                  setBusy(true);
                  const res = await runAction(loadNcertChapters(s.id));
                  setBusy(false);
                  if (res.ok && res.data) toast(res.data.added ? `Added ${res.data.added} NCERT chapter${res.data.added === 1 ? "" : "s"}` : "All NCERT chapters are already here");
                }}>{s.indexSource ? "Add missing NCERT chapters" : "Load NCERT chapters"}</Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
            {Object.entries(SUBJECT_COLORS).map(([key, hex]) => (
              <button key={key} type="button" onClick={() => runAction(updateSubject(s.id, { color: key }))} aria-label={`Colour ${key}`} aria-pressed={s.color === key}
                className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface transition", s.color === key ? "ring-2 ring-[var(--text)]" : "hover:scale-110")} style={{ background: hex }} />
            ))}
          </div>
          {s.chapters.length === 0 ? (
            <p className="text-sm text-muted">No chapters yet. Add them below. You can paste the textbook&apos;s contents page, one chapter per line.</p>
          ) : (
            <>
              <ol className="divide-y divide-border" data-testid="chapter-list">{s.chapters.map((c, i) => <ChapterRow key={c.id} c={c} index={i} total={s.chapters.length} />)}</ol>
              <p className="text-xs text-faint">Click a name to rename it. You can reorder or delete any chapter, including NCERT ones.</p>
            </>
          )}
          <form onSubmit={add} className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder={s.chapters.length ? "Revision\nPractical work" : "Chapter 1: Crop Production and Management\nChapter 2: Microorganisms"} className="min-h-20 text-sm"
              aria-label={`New chapters for ${s.name}`} maxLength={20000} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-faint">One chapter per line. “Chapter 1:” prefixes are removed.</span>
              <Button type="submit" size="sm" variant="secondary" loading={busy} disabled={!text.trim()}><ListPlus className="size-4" /> Add chapters</Button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}

export function SubjectsEditor({ classroomId, subjects, grade, indexSubjects }: { classroomId: string; subjects: EditorSubject[]; grade: string | null; indexSubjects: string[] }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const have = new Set(subjects.map((s) => s.name.toLowerCase()));
  async function add(n: string, fromInput: boolean) {
    if (!n.trim() || busy) return;
    setBusy(true);
    const res = await runAction(addSubject(classroomId, { name: n }));
    setBusy(false);
    if (res.ok && res.data?.chapters) toast(`${n.trim()} added with ${res.data.chapters} chapters from the NCERT textbook`);
    if (res.ok && fromInput) setName((cur) => (cur.trim() === n.trim() ? "" : cur));
  }
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(name, true); }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a subject" maxLength={60} aria-label="New subject name" />
        <Button type="submit" loading={busy} disabled={!name.trim()}><Plus className="size-4" /> Add</Button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {[...new Set([...indexSubjects, ...COMMON_SUBJECTS])].filter((c) => !have.has(c.toLowerCase())).map((c) => (
          <button key={c} type="button" onClick={() => add(c, false)} disabled={busy}
            className="rounded-full border border-dashed border-border-strong px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50">+ {c}</button>
        ))}
      </div>
      <p className="text-xs text-faint">
        {grade
          ? indexSubjects.length ? `For Class ${grade}, ${indexSubjects.join(", ")} come with their NCERT chapter list. Hindi and Sanskrit chapters are added by you.` : `No NCERT chapter lists are bundled for Class ${grade} yet. Add chapters yourself.`
          : "Set the class (e.g. Class 8) in Class settings to get NCERT chapter lists automatically."}
      </p>
      {subjects.length === 0 ? (
        <EmptyState className="rounded-2xl border border-dashed border-border" title="No subjects yet" description="Add the subjects this class studies. Students will file their notebook pages under them." />
      ) : (
        subjects.map((s, i) => <SubjectBlock key={s.id} s={s} defaultOpen={subjects.length === 1 || i === subjects.length - 1} />)
      )}
    </div>
  );
}
