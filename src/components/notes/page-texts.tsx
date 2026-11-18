"use client";

import { Loader2, Pencil, RefreshCw, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { convertPage, readNoteAgain, rotatePage, saveTranscript, setPageConvert } from "@/app/actions/notes";
import { useRunAction } from "../toast";
import { Badge, Button, Card, Chevron, cn, Textarea } from "../ui";
import { FormattedText } from "./formatted-text";
import { PageThumb, type GalleryImage } from "./gallery";

export type PageText = { id: string; src: string; width: number; height: number; transcript: string | null; status: string; source: string | null; error: string | null; convert: boolean };

function PageBlock({ p, index, teacher, aiOn, approved, all, title }: { p: PageText; index: number; teacher: boolean; aiOn: boolean; approved: boolean; all: GalleryImage[]; title: string }) {
  const runAction = useRunAction();
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [text, setText] = useState(p.transcript ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [convertOn, setConvertOn] = useState(p.convert);
  useEffect(() => { if (!editing) setText(p.transcript ?? ""); }, [p.transcript, editing]);
  useEffect(() => setConvertOn(p.convert), [p.convert]);
  const working = p.status === "QUEUED" || p.status === "PROCESSING";

  async function act(key: string, fn: () => Promise<{ ok: boolean }>) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    return res;
  }

  return (
    <li className="grid gap-4 py-4 md:grid-cols-[180px_minmax(0,1fr)]" data-testid="page-text">
      <div className="space-y-2">
        <PageThumb images={all} index={index} title={title} className="aspect-[3/4] w-full" />
        {teacher && (
          <div className="flex items-center justify-center gap-1">
            <Button size="sm" variant="ghost" aria-label={`Rotate page ${index + 1} left`} loading={busy === "l"}
              onClick={() => act("l", async () => { return runAction(rotatePage(p.id, 270)); })}>{busy !== "l" && <RotateCcw className="size-4" />}</Button>
            <Button size="sm" variant="ghost" aria-label={`Rotate page ${index + 1} right`} loading={busy === "r"}
              onClick={() => act("r", async () => { return runAction(rotatePage(p.id, 90)); })}>{busy !== "r" && <RotateCw className="size-4" />}</Button>
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Page {index + 1}</span>
          {!convertOn && <Badge>Not converted to text</Badge>}
          {working && <Badge tone="primary"><Loader2 className="size-3 animate-spin" /> Converting to text…</Badge>}
          {p.status === "DONE" && p.source === "AI" && <Badge><Sparkles className="size-3" /> Converted by AI. May contain mistakes</Badge>}
          {p.status === "DONE" && p.source === "TEACHER" && <Badge tone="success">Checked by teacher</Badge>}
          {p.status === "FAILED" && <Badge tone="danger">{p.error ?? "Couldn't convert this page"}</Badge>}
        </div>

        {teacher && !editing && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={convertOn} aria-label={`Convert page ${index + 1} to text`}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setConvertOn(next);
                  const res = await runAction(setPageConvert(p.id, next), next ? `Page ${index + 1} will be converted` : `Page ${index + 1} won't be converted`);
                  if (!res.ok) setConvertOn(!next);
                }} />
              Convert to text
            </label>
            {convertOn && aiOn && approved && !working && (
              <Button size="sm" variant="secondary" loading={busy === "c"}
                onClick={() => {
                  if (p.source === "TEACHER" && !confirm("Replace your checked text with a fresh AI conversion?")) return;
                  void act("c", () => runAction(convertPage(p.id), `Converting page ${index + 1}`));
                }}>
                {busy !== "c" && <Sparkles className="size-3.5" />} {p.transcript ? "Convert again" : "Convert now"}
              </Button>
            )}
            {!working && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(true); setPreview(false); }}><Pencil className="size-3.5" /> {p.transcript ? "Edit text" : "Type text"}</Button>
            )}
          </div>
        )}

        {editing ? (
          <div className="mt-3 space-y-2">
            <div role="tablist" className="inline-flex rounded-lg bg-surface-2 p-0.5 text-xs">
              {(["Write", "Preview"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={(t === "Preview") === preview} onClick={() => setPreview(t === "Preview")}
                  className={cn("rounded-md px-2.5 py-1 font-medium", (t === "Preview") === preview ? "bg-surface shadow-sm" : "text-muted")}>{t}</button>
              ))}
            </div>
            {preview ? (
              <div className="min-h-48 rounded-xl border border-border p-3.5">{text.trim() ? <FormattedText text={text} /> : <p className="text-sm text-faint">Nothing to preview</p>}</div>
            ) : (
              <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} className="min-h-48 font-mono text-xs" aria-label={`Text of page ${index + 1}`} autoFocus />
            )}
            <p className="text-xs text-faint">Formatting: ## Heading, - bullet, 1. numbered, **bold**, *italic*, | tables |.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(p.transcript ?? ""); }}>Cancel</Button>
              <Button size="sm" loading={busy === "s"} onClick={() => act("s", async () => {
                const res = await runAction(saveTranscript(p.id, text), "Page text saved");
                if (res.ok) setEditing(false);
                return res;
              })}>Save text</Button>
            </div>
          </div>
        ) : p.transcript ? (
          <div className="mt-3 rounded-xl bg-surface-2/60 p-3.5" data-testid="page-transcript"><FormattedText text={p.transcript} /></div>
        ) : !working && convertOn && p.status !== "FAILED" ? (
          <p className="mt-2 text-xs text-faint">No text yet.</p>
        ) : null}
      </div>
    </li>
  );
}

export function PageTexts({ noteId, title, pages, teacher, aiOn, approved }: { noteId: string; title: string; pages: PageText[]; teacher: boolean; aiOn: boolean; approved: boolean }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [busy, setBusy] = useState<"missing" | "all" | null>(null);
  const working = pages.some((p) => p.status === "QUEUED" || p.status === "PROCESSING");
  const missing = pages.filter((p) => p.convert && !p.transcript && (p.status === "NONE" || p.status === "FAILED")).length;
  const all: GalleryImage[] = pages.map((p) => ({ id: p.id, src: p.src, width: p.width, height: p.height }));

  // Refresh while pages are being converted (stops after ~3 minutes).
  useEffect(() => {
    if (!working) return;
    let n = 0;
    const t = setInterval(() => { if (++n > 60) clearInterval(t); else router.refresh(); }, 3000);
    return () => clearInterval(t);
  }, [working, router]);

  if (!teacher && pages.every((p) => !p.transcript && p.status !== "QUEUED" && p.status !== "PROCESSING")) return null;

  const shown = pages.filter((p) => teacher || p.transcript || p.status === "QUEUED" || p.status === "PROCESSING");
  return (
    <Card>
      <details open>
        <summary className="flex cursor-pointer items-start gap-3 px-5 pt-5 pb-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-tight">Text from the pages <span className="font-normal text-muted">({shown.length})</span></span>
            <span className="mt-0.5 block text-sm text-muted">
              {teacher ? (aiOn ? "Converted when you approve. Fix mistakes or rotate a page; your checked text is kept." : "AI is off. You can type the text yourself.") : "Searchable text from the page photos."}
            </span>
          </span>
          <Chevron className="mt-0.5" />
        </summary>
        {teacher && aiOn && approved && (
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {missing > 0 && (
              <Button size="sm" loading={busy === "missing"} onClick={async () => {
                setBusy("missing");
                await runAction(readNoteAgain(noteId, true), `Converting ${missing} page${missing === 1 ? "" : "s"}`);
                setBusy(null);
              }}>{busy !== "missing" && <Sparkles className="size-3.5" />} Convert remaining pages ({missing})</Button>
            )}
            <Button size="sm" variant="secondary" loading={busy === "all"} onClick={async () => {
              setBusy("all");
              await runAction(readNoteAgain(noteId), "Converting the pages again");
              setBusy(null);
            }}>{busy !== "all" && <RefreshCw className="size-3.5" />} Convert all again</Button>
          </div>
        )}
        <ol className="divide-y divide-border px-5 pb-2">
          {shown.map((p) => <PageBlock key={p.id} p={p} index={pages.indexOf(p)} teacher={teacher} aiOn={aiOn} approved={approved} all={all} title={title} />)}
        </ol>
      </details>
    </Card>
  );
}
