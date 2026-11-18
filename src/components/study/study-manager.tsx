"use client";

import { Check, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { approveDrafts, approveStudyItem, deleteStudyItem, generateNoteMaterial, saveFlashcard, saveQuestion } from "@/app/actions/study";
import { useRunAction, useToast } from "../toast";
import { Alert, Badge, Button, Chevron, Field, Input, Select, Textarea } from "../ui";

export type ManagerNote = { id: string; title: string; date: string; enoughText: boolean; cards: number; questions: number; drafts: number };
export type ManagerCard = { id: string; front: string; back: string; noteId: string | null; draft: boolean; source: string };
export type ManagerQuestion = { id: string; question: string; answer: string; keyPoints: string[]; noteId: string | null; draft: boolean; source: string };

/** Teacher tools for one chapter: generate from approved notes, check the drafts, add or fix items by hand. */
/**
 * Teacher tools for ONE kind of material in a chapter: flashcards (Flashcards tab) or written-answer questions
 * (Study tab). Generate from approved notes, check the drafts, add or fix items by hand.
 */
export function StudyManager({ kind, chapterId, notes, cards = [], questions = [], aiOn }: { kind: "flashcards" | "questions"; chapterId: string; notes: ManagerNote[]; cards?: ManagerCard[]; questions?: ManagerQuestion[]; aiOn: boolean }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyNote, setBusyNote] = useState<string | null>(null);
  // How many to make per note (0 = Auto: an amount that suits the length of the notes).
  const [count, setCount] = useState(0);
  const cardsKind = kind === "flashcards";
  const word = cardsKind ? "flashcards" : "questions";
  const items = cardsKind ? cards : questions;
  const drafts = items.filter((i) => i.draft).length;
  const noteTitle = (id: string | null) => notes.find((n) => n.id === id)?.title ?? null;
  const have = (n: ManagerNote) => (cardsKind ? n.cards : n.questions);
  const pending = notes.filter((n) => have(n) === 0 && n.enoughText);

  async function generateOne(note: ManagerNote, replace: boolean) {
    if (replace && !confirm(`Replace the AI-made ${word} for this note with new ones? Items you wrote yourself are kept.`)) return;
    setBusyNote(note.id);
    const res = await runAction(generateNoteMaterial(note.id, kind, replace, count || undefined));
    setBusyNote(null);
    if (res.ok && res.data) return true;
    return false;
  }

  async function generateAll() {
    setProgress({ done: 0, total: pending.length });
    let ok = 0;
    for (const [i, n] of pending.entries()) {
      if (await generateOne(n, false)) ok++;
      setProgress({ done: i + 1, total: pending.length });
    }
    setProgress(null);
    if (ok > 0) toast(`Made ${word} for ${ok} note${ok === 1 ? "" : "s"}. Check them, then approve.`);
  }

  return (
    <div className="space-y-5">
      {!aiOn && <Alert tone="warn">AI is off, so nothing can be generated. You can still add {word} by hand below.</Alert>}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Notes in this chapter</h3>
          {aiOn && pending.length > 0 && (
            <Button size="sm" onClick={generateAll} loading={!!progress} data-testid="generate-all">
              <Sparkles className="size-4" /> {progress ? `Making ${progress.done + 1} of ${progress.total}…` : `Make ${word} for ${pending.length} note${pending.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>
        {aiOn && notes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3" data-testid="study-counts">
            <CountPicker label={cardsKind ? "Flashcards per note" : "Questions per note"} value={count} onChange={setCount} />
          </div>
        )}
        {notes.length === 0 ? <p className="mt-2 text-sm text-muted">No approved notes in this chapter yet. {cardsKind ? "Flashcards are" : "Questions are"} made from approved notes.</p> : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5" data-testid="manager-note">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted">
                    {n.date} · {cardsKind ? `${n.cards} card${n.cards === 1 ? "" : "s"}` : `${n.questions} question${n.questions === 1 ? "" : "s"}`}
                    {n.drafts > 0 && <span className="text-warn"> · {n.drafts} to check</span>}
                    {!n.enoughText && have(n) === 0 && " · not enough written text yet"}
                  </p>
                </div>
                {aiOn && (
                  <Button size="sm" variant="secondary" loading={busyNote === n.id} disabled={!n.enoughText && have(n) === 0}
                    onClick={() => generateOne(n, have(n) > 0)} aria-label={`${have(n) > 0 ? "Regenerate" : "Generate"} for ${n.title}`}>
                    {have(n) > 0 ? <><RefreshCw className="size-3.5" /> Regenerate</> : <><Sparkles className="size-3.5" /> Generate</>}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {drafts > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn" data-testid="drafts-banner">
          <span><strong>{drafts}</strong> item{drafts === 1 ? " is" : "s are"} waiting for you. Students can&apos;t see drafts until you approve them.</span>
          <Button size="sm" onClick={() => runAction(approveDrafts(chapterId, kind), "Approved. Students can use them now")}><Check className="size-4" /> Approve all drafts</Button>
        </div>
      )}

      {cardsKind ? (
        <ItemList title="Flashcards" count={cards.length} adder={(close) => <FlashcardEditor chapterId={chapterId} notes={notes} onDone={close} />}>
        {cards.map((c) => (
          <ItemRow key={c.id} kind="flashcard" id={c.id} draft={c.draft} source={c.source} noteTitle={noteTitle(c.noteId)}
            editor={(close) => <FlashcardEditor chapterId={chapterId} notes={notes} initial={c} onDone={close} />}>
            <p className="text-sm font-medium">{c.front}</p>
            <p className="text-sm text-muted">{c.back}</p>
          </ItemRow>
        ))}
      </ItemList>
      ) : (
        <ItemList title="Quiz questions (written answers)" count={questions.length} adder={(close) => <QuestionEditor chapterId={chapterId} notes={notes} onDone={close} />}>
        {questions.map((q) => (
          <ItemRow key={q.id} kind="question" id={q.id} draft={q.draft} source={q.source} noteTitle={noteTitle(q.noteId)}
            editor={(close) => <QuestionEditor chapterId={chapterId} notes={notes} initial={q} onDone={close} />}>
            <p className="text-sm font-medium">{q.question}</p>
            <p className="mt-1 text-sm text-muted"><span className="font-medium text-success">Model answer:</span> {q.answer}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">{q.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </ItemRow>
        ))}
      </ItemList>
      )}
    </div>
  );
}

function ItemList({ title, count, adder, children }: { title: string; count: number; adder: (close: () => void) => React.ReactNode; children: React.ReactNode }) {
  const [adding, setAdding] = useState(false);
  return (
    <details className="rounded-xl border border-border" open={count > 0 && count <= 12}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold">
        <span className="flex-1">{title} <span className="font-normal text-muted">({count})</span></span>
        <Button size="sm" variant="secondary" onClick={(e) => { e.preventDefault(); setAdding(!adding); }}><Plus className="size-3.5" /> Add by hand</Button>
        <Chevron className="size-4" />
      </summary>
      {adding && <div className="border-t border-border bg-surface-2/40 p-3">{adder(() => setAdding(false))}</div>}
      <ul className="divide-y divide-border border-t border-border">{children}</ul>
      {count === 0 && <p className="border-t border-border px-3 py-3 text-sm text-muted">None yet.</p>}
    </details>
  );
}

function ItemRow({ kind, id, draft, source, noteTitle, children, editor }: { kind: "flashcard" | "question"; id: string; draft: boolean; source: string; noteTitle: string | null; children: React.ReactNode; editor: (close: () => void) => React.ReactNode }) {
  const runAction = useRunAction();
  const [editing, setEditing] = useState(false);
  if (editing) return <li className="bg-surface-2/40 p-3">{editor(() => setEditing(false))}</li>;
  return (
    <li className="flex flex-wrap items-start gap-3 px-3 py-3" data-testid={`${kind}-row`}>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {draft ? <Badge tone="warn">Draft</Badge> : <Badge tone="success">Approved</Badge>}
          {source === "AI" ? <Badge>AI-made</Badge> : <Badge tone="primary">Written by a teacher</Badge>}
          {noteTitle && <span className="truncate text-xs text-muted">from “{noteTitle}”</span>}
        </div>
        {children}
      </div>
      <div className="flex gap-1">
        {draft && <Button size="sm" onClick={() => runAction(approveStudyItem(kind, id), "Approved")} aria-label="Approve"><Check className="size-3.5" /> Approve</Button>}
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)} aria-label="Edit"><Pencil className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => runAction(deleteStudyItem(kind, id), "Deleted")} aria-label="Delete"><Trash2 className="size-4" /></Button>
      </div>
    </li>
  );
}

const noteOptions = (notes: ManagerNote[]) => (
  <>
    <option value="">Whole chapter (no particular note)</option>
    {notes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
  </>
);

function FlashcardEditor({ chapterId, notes, initial, onDone }: { chapterId: string; notes: ManagerNote[]; initial?: ManagerCard; onDone?: () => void }) {
  const runAction = useRunAction();
  const uid = useId();
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [noteId, setNoteId] = useState(initial?.noteId ?? "");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(saveFlashcard(chapterId, initial?.id ?? null, noteId || null, { front, back }), initial ? "Saved and approved" : "Flashcard added");
    setBusy(false);
    if (res.ok) { if (!initial) { setFront(""); setBack(""); } onDone?.(); }
  }
  return (
    <form onSubmit={save} className="space-y-2.5">
      <Field label="Front (a question or prompt)" htmlFor={`${uid}-front`}><Input id={`${uid}-front`} value={front} onChange={(e) => setFront(e.target.value)} maxLength={200} required /></Field>
      <Field label="Back (the answer)" htmlFor={`${uid}-back`}><Textarea id={`${uid}-back`} className="min-h-16" value={back} onChange={(e) => setBack(e.target.value)} maxLength={400} required /></Field>
      <Field label="From note" htmlFor={`${uid}-n`} optional><Select id={`${uid}-n`} value={noteId} onChange={(e) => setNoteId(e.target.value)}>{noteOptions(notes)}</Select></Field>
      <div className="flex gap-2"><Button type="submit" size="sm" loading={busy} disabled={front.trim().length < 3 || !back.trim()}>{initial ? "Save and approve" : "Add flashcard"}</Button>{onDone && <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>}</div>
    </form>
  );
}

function QuestionEditor({ chapterId, notes, initial, onDone }: { chapterId: string; notes: ManagerNote[]; initial?: ManagerQuestion; onDone?: () => void }) {
  const runAction = useRunAction();
  const uid = useId();
  const [question, setQuestion] = useState(initial?.question ?? "");
  const [answer, setAnswer] = useState(initial?.answer ?? "");
  const [keyPoints, setKeyPoints] = useState((initial?.keyPoints ?? []).join("\n"));
  const [noteId, setNoteId] = useState(initial?.noteId ?? "");
  const [busy, setBusy] = useState(false);
  const points = keyPoints.split("\n").map((k) => k.trim()).filter(Boolean);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(saveQuestion(chapterId, initial?.id ?? null, noteId || null, { question, answer, keyPoints: points }), initial ? "Saved and approved" : "Question added");
    setBusy(false);
    if (res.ok) { if (!initial) { setQuestion(""); setAnswer(""); setKeyPoints(""); } onDone?.(); }
  }
  return (
    <form onSubmit={save} className="space-y-2.5">
      <Field label="Question (students answer in their own words)" htmlFor={`${uid}-q`}><Textarea id={`${uid}-q`} className="min-h-16" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={400} required /></Field>
      <Field label="Model answer" htmlFor={`${uid}-a`} hint="A few short sentences. The AI judges students' answers against this."><Textarea id={`${uid}-a`} className="min-h-16" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={500} required /></Field>
      <Field label="Key points a correct answer should contain" htmlFor={`${uid}-k`} hint="One per line, 1 to 4. A student who says the same thing in other words still gets the marks."><Textarea id={`${uid}-k`} className="min-h-20" value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} required /></Field>
      <Field label="From note" htmlFor={`${uid}-n`} optional><Select id={`${uid}-n`} value={noteId} onChange={(e) => setNoteId(e.target.value)}>{noteOptions(notes)}</Select></Field>
      <div className="flex gap-2"><Button type="submit" size="sm" loading={busy} disabled={question.trim().length < 8 || answer.trim().length < 3 || points.length < 1 || points.length > 4}>{initial ? "Save and approve" : "Add question"}</Button>{onDone && <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>}</div>
    </form>
  );
}

/** "How many to make" picker shared by the generators. 0 means Auto when `auto` is on. */
export function CountPicker({ label, value, onChange, auto = true, choices = [3, 5, 8, 10, 15] }: { label: string; value: number; onChange: (n: number) => void; auto?: boolean; choices?: number[] }) {
  const id = useId(); // unique, since two generators on one page both have a "Questions per note" picker
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-muted">
      {label}
      <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-auto py-0 text-sm">
        {auto && <option value={0}>Auto</option>}
        {choices.map((n) => <option key={n} value={n}>{n}</option>)}
      </Select>
    </label>
  );
}
