"use client";

import { BarChart3, Camera, CheckCircle2, Mail, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmMarks, deleteSheet, makeSheet, markWork, publishSheet, updateSheet } from "@/app/actions/homework";
import { parentNote, type HwMarks, type HwQuestion } from "@/lib/homework";
import { useRunAction } from "../toast";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select, Textarea } from "../ui";

/** Teacher: pick a chapter, how many questions and the level; the AI writes a draft sheet from the chapter's approved notes. */
export function MakeSheetForm({ classroomId, subjects }: { classroomId: string; subjects: { id: string; name: string; chapters: { id: string; name: string }[] }[] }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [sub, setSub] = useState(subjects[0]?.id ?? "");
  const chapters = subjects.find((s) => s.id === sub)?.chapters ?? [];
  const [ch, setCh] = useState(chapters[0]?.id ?? "");
  const [count, setCount] = useState(8);
  const [level, setLevel] = useState("Medium");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!subjects.length) return null;
  return (
    <Card data-testid="make-sheet">
      <CardHeader icon={<Sparkles className="size-5" />} title="Make a homework sheet" description="The AI writes questions for a chapter from its approved notes, with an answer key. You check and edit it before publishing." />
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
        <Field label="Subject" htmlFor="hw-sub"><Select id="hw-sub" value={sub} onChange={(e) => { setSub(e.target.value); setCh(subjects.find((s) => s.id === e.target.value)?.chapters[0]?.id ?? ""); }}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Chapter" htmlFor="hw-ch"><Select id="hw-ch" value={ch} onChange={(e) => setCh(e.target.value)}>{chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Questions" htmlFor="hw-n"><Select id="hw-n" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[5, 8, 10, 15].map((n) => <option key={n}>{n}</option>)}</Select></Field>
        <Field label="Level" htmlFor="hw-lv"><Select id="hw-lv" value={level} onChange={(e) => setLevel(e.target.value)}>{["Easy", "Medium", "Exam style"].map((l) => <option key={l}>{l}</option>)}</Select></Field>
        <Field label="Instructions for students" optional htmlFor="hw-note" className="sm:col-span-2"><Textarea id="hw-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Write in full sentences and show your working." /></Field>
        <div className="sm:col-span-2"><Button loading={busy} disabled={!ch} data-testid="make-sheet-go" onClick={async () => {
          setBusy(true);
          const r = await runAction(makeSheet(classroomId, { chapterId: ch, count, level, note }), "Draft homework sheet ready");
          setBusy(false);
          if (r.ok && r.data) router.push(`/classes/${classroomId}/homework/${r.data.sheetId}`);
        }}>{!busy && <Sparkles className="size-4" />} {busy ? "Writing…" : "Make homework"}</Button></div>
      </div>
    </Card>
  );
}

/** Teacher: edit, publish, print or delete a sheet; show or hide the answer key. */
export function SheetEditor({ sheetId, title, note, questions, published, className }: { sheetId: string; title: string; note: string; questions: HwQuestion[]; published: boolean; className: string }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [t, setT] = useState(title);
  const [n, setN] = useState(note);
  const [qs, setQs] = useState(questions);
  const [key, setKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = t !== title || n !== note || JSON.stringify(qs) !== JSON.stringify(questions);
  const total = qs.reduce((s, q) => s + q.marks, 0);
  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    w.document.write(`<!doctype html><title>${esc(t)}</title><body style="font:15px/1.5 Georgia,serif;padding:32px;max-width:760px;margin:auto"><h2>${esc(t)}</h2><p>Class: ${esc(className)} &nbsp; Name: ____________________ &nbsp; Date: ____________</p>${n ? `<p><b>Instructions:</b> ${esc(n)}</p>` : ""}<ol>${qs.map((q) => `<li>${esc(q.q)} <small>[${q.marks}]</small><div style="height:${q.marks >= 3 ? 120 : q.marks === 2 ? 70 : 36}px"></div></li>`).join("")}</ol></body>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <Card className="space-y-4 p-5" data-testid="sheet-editor">
      <div className="flex flex-wrap items-center gap-2">
        {published ? <Badge tone="success">Published</Badge> : <Badge tone="warn">Draft: only you can see it</Badge>}
        <span className="text-sm text-muted">{qs.length} questions · {total} marks</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => setKey((k) => !k)}>{key ? "Hide answer key" : "Show answer key"}</Button>
          <Button size="sm" variant="ghost" onClick={print}><Printer className="size-3.5" /> Print</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (!confirm("Delete this homework sheet and any marks?")) return; const r = await runAction(deleteSheet(sheetId), "Deleted"); if (r.ok) router.back(); }}><Trash2 className="size-3.5" /> Delete</Button>
        </span>
      </div>
      <Input value={t} onChange={(e) => setT(e.target.value)} maxLength={80} aria-label="Sheet title" className="text-base font-semibold" />
      <Textarea value={n} onChange={(e) => setN(e.target.value)} rows={2} maxLength={300} aria-label="Instructions for students" placeholder="Instructions for students (optional)" />
      <ol className="space-y-3">
        {qs.map((q, i) => (
          <li key={i} className="rounded-xl border border-border p-3" data-testid="sheet-question">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-sm font-medium text-faint">{i + 1}.</span>
              <Textarea value={q.q} rows={2} aria-label={`Question ${i + 1}`} onChange={(e) => setQs(qs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))} className="flex-1" />
              <Select aria-label={`Marks for question ${i + 1}`} value={q.marks} onChange={(e) => setQs(qs.map((x, k) => (k === i ? { ...x, marks: Number(e.target.value) } : x)))} className="w-20">{[1, 2, 3, 4, 5].map((m) => <option key={m} value={m}>{m}</option>)}</Select>
              <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setQs(qs.filter((_, k) => k !== i))} disabled={qs.length <= 1} className="mt-1.5 rounded p-1.5 text-faint hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
            </div>
            {key && <Textarea value={q.answer} rows={2} aria-label={`Answer key for question ${i + 1}`} onChange={(e) => setQs(qs.map((x, k) => (k === i ? { ...x, answer: e.target.value } : x)))} className="mt-2 bg-success-soft/40 text-sm" />}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="ghost" onClick={() => setQs([...qs, { q: "", marks: 1, answer: "" }])}><Plus className="size-3.5" /> Add a question</Button>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" loading={busy} disabled={!dirty} onClick={async () => { setBusy(true); const r = await runAction(updateSheet(sheetId, { title: t, note: n, questions: qs }), "Saved"); setBusy(false); if (r.ok) router.refresh(); }}>Save changes</Button>
        <Button data-testid="publish-sheet" onClick={async () => {
          if (dirty) { const r = await runAction(updateSheet(sheetId, { title: t, note: n, questions: qs })); if (!r.ok) return; }
          const r = await runAction(publishSheet(sheetId, !published), published ? "Taken back: students can't see it" : "Published to the class");
          if (r.ok) router.refresh();
        }}>{published ? "Unpublish" : "Publish to the class"}</Button>
      </div>
    </Card>
  );
}

type Row = { id: string; name: string; consent: boolean; submitted: boolean; answers: string[] | null; status: "SUGGESTED" | "CONFIRMED" | null; marks: HwMarks | null };

const toDataUrl = (file: File) => new Promise<string>((res, rej) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.85)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
  img.src = url;
});

/** Teacher: each student's homework. The AI suggests marks (typed answers or a photo of the paper); you adjust and confirm. */
export function MarkingTable({ sheetId, questions, rows }: { sheetId: string; questions: HwQuestion[]; rows: Row[] }) {
  return (
    <Card data-testid="marking">
      <CardHeader icon={<CheckCircle2 className="size-5" />} title="Marking" description="Suggested marks come from AI and stay hidden from the student until you confirm them. Photos of paper answers aren't kept. A student's work is only sent to the AI once you've confirmed their consent form." />
      {rows.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No students in this class yet.</p> : (
        <ul className="divide-y divide-border">{rows.map((r) => <MarkRow key={r.id} sheetId={sheetId} questions={questions} row={r} />)}</ul>
      )}
    </Card>
  );
}

function MarkRow({ sheetId, questions, row }: { sheetId: string; questions: HwQuestion[]; row: Row }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(row.status === "SUGGESTED");
  const [awarded, setAwarded] = useState<number[]>(row.marks?.answers.map((a) => a.awarded) ?? []);
  const [feedback, setFeedback] = useState(row.marks?.feedback ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const outOf = questions.reduce((n, q) => n + q.marks, 0);
  const mark = async (photos: string[]) => {
    setBusy(true);
    const r = await runAction(markWork(sheetId, row.id, photos), "Marks suggested. Check them, then confirm.");
    setBusy(false);
    if (r.ok && r.data) { setAwarded(r.data.answers.map((a) => a.awarded)); setFeedback(r.data.feedback); setOpen(true); router.refresh(); }
  };
  return (
    <li className="px-5 py-3" data-testid="mark-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">{row.name}</span>
        {row.status === "CONFIRMED" ? <Badge tone="success">{awarded.reduce((a, b) => a + b, 0)} / {outOf} · confirmed</Badge>
          : row.status === "SUGGESTED" ? <Badge tone="warn">Suggested · check it</Badge>
          : row.submitted ? <Badge>Handed in</Badge> : <Badge>Not handed in</Badge>}
        {!row.consent ? <span className="text-xs text-muted">Confirm their consent form to mark with AI</span> : (
          <span className="flex gap-1">
            {row.submitted && <Button size="sm" variant="secondary" loading={busy} onClick={() => mark([])} data-testid="mark-typed">Mark with AI</Button>}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Camera className="size-3.5" /> From a photo</Button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden data-testid="mark-photo" onChange={async (e) => { const fs = [...(e.target.files ?? [])].slice(0, 4); e.target.value = ""; if (!fs.length) return; try { await mark(await Promise.all(fs.map(toDataUrl))); } catch { /* toast shown by action */ } }} />
          </span>
        )}
        {row.marks && <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Review"}</Button>}
      </div>
      {open && row.marks && (
        <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3" data-testid="mark-review">
          <ol className="space-y-2 text-sm">
            {questions.map((q, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2">
                <span className="min-w-0 flex-1"><span className="font-medium">{i + 1}. {q.q}</span>
                  {row.answers?.[i] && <span className="mt-0.5 block text-xs text-muted">Answer: {row.answers[i]}</span>}
                  <span className="mt-0.5 block text-xs text-muted">{row.marks!.answers[i]?.comment}</span></span>
                <label className="flex items-center gap-1 text-xs"><input type="number" min={0} max={q.marks} step={0.5} value={awarded[i] ?? 0} aria-label={`Marks for question ${i + 1}`}
                  onChange={(e) => setAwarded(awarded.map((a, k) => (k === i ? Math.max(0, Math.min(q.marks, Number(e.target.value))) : a)))} className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-sm" /> / {q.marks}</label>
              </li>
            ))}
          </ol>
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={500} aria-label="Feedback for the student" />
          {row.marks.weak.length > 0 && <p className="text-xs text-muted">Topics to revise: {row.marks.weak.join(", ")}</p>}
          <Button size="sm" loading={busy} data-testid="confirm-marks" onClick={async () => { setBusy(true); const r = await runAction(confirmMarks(sheetId, row.id, awarded, feedback), "Marks confirmed. The student can see them now."); setBusy(false); if (r.ok) router.refresh(); }}>
            Confirm {awarded.reduce((a, b) => a + b, 0)} / {outOf}
          </Button>
        </div>
      )}
    </li>
  );
}

type SheetSummary = { id: string; title: string; average: number | null; marked: number; weak: string[]; perStudent: { userId: string; title: string; total: number; outOf: number; weak: string[] }[] };

/** Teacher: how the class is doing across homework, topics to revise, and a parent note per student (sent from your own email). */
export function HomeworkInsights({ classroomId, className, sheets, students }: { classroomId: string; className: string; sheets: SheetSummary[]; students: { id: string; name: string }[] }) {
  const marked = sheets.filter((s) => s.marked > 0);
  if (!marked.length) return null;
  const weak = new Map<string, number>();
  marked.forEach((s) => s.weak.forEach((w) => weak.set(w.toLowerCase(), (weak.get(w.toLowerCase()) ?? 0) + 1)));
  const topics = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const per = students.map((st) => {
    const rs = marked.flatMap((s) => s.perStudent.filter((p) => p.userId === st.id));
    return { ...st, rs, avg: rs.length ? Math.round((rs.reduce((n, r) => n + r.total / (r.outOf || 1), 0) / rs.length) * 100) : null };
  }).filter((x) => x.rs.length).sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0));
  void classroomId;
  return (
    <Card data-testid="homework-insights">
      <CardHeader icon={<BarChart3 className="size-5" />} title="Homework insights" description="From confirmed marks only." />
      <div className="space-y-4 px-5 pb-5">
        {topics.length > 0 && <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Topics the class finds hard</p><div className="flex flex-wrap gap-1.5">{topics.map(([t, n]) => <span key={t} className="rounded-full bg-warn-soft px-2.5 py-1 text-xs text-warn">{t} · {n}</span>)}</div></div>}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted"><th className="py-1 font-medium">Student (lowest first)</th><th className="font-medium">Average</th><th /></tr></thead>
          <tbody className="divide-y divide-border">
            {per.map((p) => (
              <tr key={p.id}>
                <td className="py-2">{p.name}</td>
                <td className={cn("tabular-nums", (p.avg ?? 0) < 50 ? "text-danger" : (p.avg ?? 0) >= 75 ? "text-success" : "")}>{p.avg}%</td>
                <td className="text-right">
                  <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" target="_blank" rel="noopener"
                    href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(`${p.name}: homework update`)}&body=${encodeURIComponent(parentNote({ student: p.name, className, teacher: "Class teacher", results: p.rs, weak: [...new Set(p.rs.flatMap((r) => r.weak))] }))}`}>
                    <Mail className="size-3.5" /> Parent note
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-faint">Parent notes open a draft in your own Gmail; nothing is sent from the app.</p>
      </div>
    </Card>
  );
}
