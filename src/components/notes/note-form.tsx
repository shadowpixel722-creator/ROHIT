"use client";

import { ArrowLeft, ArrowRight, Camera, Crop, FileText, ImagePlus, Loader2, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createNote, updateNote } from "@/app/actions/notes";
import { useRunAction, useToast } from "../toast";
import { Alert, Button, Card, cn, Field, Input, Select, Textarea } from "../ui";
import { PageAdjuster } from "./page-adjuster";
import { ATTACHMENT_ACCEPT, ATTACHMENT_KINDS, extOf, formatBytes, kindLabel, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/attachment-check";

export type FormSubject = { id: string; name: string; chapters: { id: string; name: string }[] };
type Existing = { id: string; src: string };
type ExistingFile = { id: string; fileName: string; size: number };
type Picked = { key: string; file: File; url: string; convert: boolean };

const MAX_PAGES = 20;
const MAX_EDGE = 2000;

/**
 * Downscales and re-encodes a photo in the browser before upload.
 * Re-encoding through a canvas drops EXIF data (including GPS location) and keeps uploads small.
 * The server re-encodes again, so this is a first layer, not the only one.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // Unsupported in this browser (e.g. HEIC): the server will explain.
  }
}

/** `room`: a student room or personal space, where notes appear straight away (no teacher review). */
export function NoteForm({ classroomId, subjects, teacher, room = false, note, defaultSubjectId }: {
  classroomId: string;
  subjects: FormSubject[];
  teacher: boolean;
  room?: boolean;
  note?: { id: string; title: string; text: string; subjectId: string; chapterId: string; lessonDate: string; images: Existing[]; attachments?: ExistingFile[]; status: string };
  defaultSubjectId?: string;
}) {
  const router = useRouter();
  const runAction = useRunAction();
  const toast = useToast();
  const [title, setTitle] = useState(note?.title ?? "");
  const [text, setText] = useState(note?.text ?? "");
  const [subjectId, setSubjectId] = useState(note?.subjectId ?? defaultSubjectId ?? subjects[0]?.id ?? "");
  const [chapterId, setChapterId] = useState(note?.chapterId ?? "");
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [lessonDate, setLessonDate] = useState(note?.lessonDate || today);
  const [existing, setExisting] = useState<Existing[]>(note?.images ?? []);
  const [removed, setRemoved] = useState<string[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  // Attachments (PDF, Word, PowerPoint, Excel, text): checked by content on the server too.
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>(note?.attachments ?? []);
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const subject = subjects.find((s) => s.id === subjectId);
  const total = existing.length + picked.length;

  // Free preview URLs only when the form goes away (revoking on every change would break visible previews).
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function add(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return toast("Choose photo files (JPG, PNG or WEBP).", "error");
    const room = MAX_PAGES - total;
    if (files.length > room) toast(`A note can have up to ${MAX_PAGES} pages. Only the first ${room} were added.`, "error");
    setProcessing(true);
    const out: Picked[] = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      const small = await shrink(f);
      const url = URL.createObjectURL(small);
      urls.current.push(url);
      out.push({ key: `${Date.now()}-${Math.random()}`, file: small, url, convert: true });
    }
    setPicked((p) => [...p, ...out]);
    setProcessing(false);
    if (input.current) input.current.value = "";
    if (camera.current) camera.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    setPicked((p) => {
      const next = [...p];
      const j = i + dir;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addFiles(list: FileList) {
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ATTACHMENT_ACCEPT.split(",").includes(`.${extOf(f.name)}`)) { toast(`“${f.name}” can't be attached. Use ${ATTACHMENT_KINDS}.`, "error"); continue; }
      if (f.size > MAX_ATTACHMENT_BYTES) { toast(`“${f.name}” is larger than 10 MB.`, "error"); continue; }
      if (existingFiles.length + next.length >= MAX_ATTACHMENTS) { toast(`A note can have up to ${MAX_ATTACHMENTS} attachments.`, "error"); break; }
      next.push(f);
    }
    setFiles(next);
  }
  const attachmentCount = existingFiles.length + files.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("classroomId", classroomId);
    form.set("title", title);
    form.set("text", text);
    form.set("subjectId", subjectId);
    form.set("chapterId", chapterId);
    form.set("lessonDate", lessonDate);
    picked.forEach((p) => {
      form.append("images", p.file);
      form.append("convert", p.convert ? "1" : "0"); // same order as images
    });
    removed.forEach((id) => form.append("removeImageIds", id));
    files.forEach((f) => form.append("attachments", f));
    removedFiles.forEach((id) => form.append("removeAttachmentIds", id));
    setBusy(true);
    const res = note ? await runAction(updateNote(note.id, form)) : await runAction(createNote(form));
    setBusy(false);
    if (!res.ok) return;
    const data = res.data as { status: string; id?: string };
    const status = data.status;
    toast(status === "APPROVED" ? (note ? "Note updated" : "Note added to the class notebook") : "Sent to your teacher for approval");
    const id = note?.id ?? data.id;
    router.push(`/classes/${classroomId}/notebook/${id}`);
  }

  if (subjects.length === 0)
    return <Alert tone="warn">{teacher || room ? "Add subjects on the Overview tab first, so notes can be filed under them." : "Your teacher hasn't allowed you to add notes yet. You can still read and discuss every approved note."}</Alert>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {adjusting && (() => {
        const target = picked.find((p) => p.key === adjusting);
        return target ? (
          <PageAdjuster file={target.file} onCancel={() => setAdjusting(null)}
            onDone={(f) => {
              const url = URL.createObjectURL(f);
              urls.current.push(url);
              setPicked((x) => x.map((y) => (y.key === adjusting ? { ...y, file: f, url } : y)));
              setAdjusting(null);
            }} />
        ) : null;
      })()}
      {!teacher && (
        <Alert tone="neutral">
          {room ? "Your note appears straight away for everyone here." : note?.status === "APPROVED" ? "Editing an approved note sends it back to your teacher for approval." : "Your teacher reviews every note before the class can see it."}{" "}
          Don&apos;t include faces, names, phone numbers or other personal details in photos.
        </Alert>
      )}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor="subj">
            <Select id="subj" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); }}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Chapter" htmlFor="chap" optional>
            <Select id="chap" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!subject?.chapters.length}>
              <option value="">{subject?.chapters.length ? "General / not a specific chapter" : "No chapters in this subject"}</option>
              {subject?.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Date of these notes" htmlFor="ndate" hint="The day this lesson was written in the notebook.">
          <Input id="ndate" type="date" value={lessonDate} max={today} onChange={(e) => setLessonDate(e.target.value)} required className="sm:max-w-56" />
        </Field>
        <Field label="Title" htmlFor="ntitle">
          <Input id="ntitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Coal and Petroleum: class notes, 4 Nov" required />
        </Field>
      </Card>

      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Notebook pages</h2>
          <span className="text-xs text-muted">{total}/{MAX_PAGES}</span>
        </div>
        {(existing.length > 0 || picked.length > 0) && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existing.map((img, i) => (
              <li key={img.id} className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                <button type="button" onClick={() => { setExisting((x) => x.filter((y) => y.id !== img.id)); setRemoved((r) => [...r, img.id]); }}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label={`Remove page ${i + 1}`}><X className="size-4" /></button>
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 text-[11px] text-white">{i + 1}</span>
              </li>
            ))}
            {picked.map((p, i) => (
              <li key={p.key} className="overflow-hidden rounded-xl border border-primary/40 bg-surface-2" data-testid="picked-page">
                <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`New page ${existing.length + i + 1}`} className="aspect-[3/4] w-full object-contain bg-white" />
                <button type="button" onClick={() => setPicked((x) => x.filter((y) => y.key !== p.key))}
                  className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white" aria-label={`Remove new page ${existing.length + i + 1}`}><X className="size-4" /></button>
                <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between">
                  <span className="rounded-md bg-black/60 px-1.5 text-[11px] text-white">{existing.length + i + 1}</span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-6 place-items-center rounded-full bg-black/60 text-white disabled:opacity-30" aria-label="Move page earlier"><ArrowLeft className="size-3.5" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === picked.length - 1} className="grid size-6 place-items-center rounded-full bg-black/60 text-white disabled:opacity-30" aria-label="Move page later"><ArrowRight className="size-3.5" /></button>
                  </span>
                </div>
                </div>
                <div className="flex items-center justify-between gap-1 border-t border-border bg-surface px-2 py-1.5">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-medium" title="Turn off for drawings or pages without writing">
                    <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={p.convert} aria-label={`Convert new page ${existing.length + i + 1} to text`}
                      onChange={(e) => setPicked((x) => x.map((y) => (y.key === p.key ? { ...y, convert: e.target.checked } : y)))} />
                    To text
                  </label>
                  <button type="button" onClick={() => setAdjusting(p.key)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary-soft" aria-label={`Adjust new page ${existing.length + i + 1}`}>
                    <Crop className="size-3" /> Adjust
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total < MAX_PAGES && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void add(e.dataTransfer.files); }}
            className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors", drag ? "border-primary bg-primary-soft" : "border-border-strong")}>
            {processing ? <Loader2 className="size-6 animate-spin text-primary" /> : <ImagePlus className="size-6 text-primary" />}
            <p className="text-sm text-muted">{processing ? "Preparing photos…" : "Drop photos here, or"}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={processing}><ImagePlus className="size-4" /> Choose photos</Button>
              <Button variant="secondary" size="sm" onClick={() => camera.current?.click()} disabled={processing} className="sm:hidden"><Camera className="size-4" /> Take photo</Button>
            </div>
            <p className="text-xs text-faint">JPG, PNG or WEBP · up to {MAX_PAGES} pages. Pages are straightened automatically; use Adjust to rotate or crop. Location and camera details are removed.</p>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Choose notebook photos" />
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files && add(e.target.files)} aria-label="Take a photo" />
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4 sm:p-5" data-testid="attachments-card">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4 text-primary" /> Attachments <span className="font-normal text-muted">(optional)</span></h2>
          <span className="text-xs text-muted">{attachmentCount}/{MAX_ATTACHMENTS}</span>
        </div>
        {attachmentCount > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border" data-testid="attachment-list">
            {existingFiles.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate">{f.fileName}</span>
                <span className="text-xs text-muted">{kindLabel(f.fileName)} · {formatBytes(f.size)}</span>
                <button type="button" onClick={() => { setExistingFiles((x) => x.filter((y) => y.id !== f.id)); setRemovedFiles((r) => [...r, f.id]); }}
                  className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger" aria-label={`Remove ${f.fileName}`}><X className="size-4" /></button>
              </li>
            ))}
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted">{kindLabel(f.name)} · {formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}
                  className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger" aria-label={`Remove ${f.name}`}><X className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {attachmentCount < MAX_ATTACHMENTS && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}><Paperclip className="size-4" /> Attach files</Button>
            <span className="text-xs text-faint">{ATTACHMENT_KINDS} · up to {MAX_ATTACHMENTS} files, 10 MB each. Others in the class download them.</span>
            <input ref={fileInput} type="file" accept={ATTACHMENT_ACCEPT} multiple className="sr-only" aria-label="Choose files to attach"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          </div>
        )}
        {!teacher && attachmentCount > 0 && <p className="text-xs text-muted">Files can hide your name in their properties. Remove personal details before attaching.</p>}
      </Card>

      <Card className="p-4 sm:p-5">
        <Field label="Typed notes" htmlFor="ntext" optional hint={`Type notes instead of, or as well as, photos. ${text.length.toLocaleString()} / 20,000`}>
          <Textarea id="ntext" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} className="min-h-40" placeholder="Key points, definitions, diagrams described in words…" />
        </Field>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={busy} disabled={processing || !title.trim() || !lessonDate || (total === 0 && attachmentCount === 0 && !text.trim())}>
          {note ? (teacher || room ? "Save changes" : "Save and resubmit") : teacher || room ? "Add to notebook" : "Send for approval"}
        </Button>
      </div>
    </form>
  );
}
