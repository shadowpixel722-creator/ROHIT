"use client";

import { ArrowRight, Box, Camera, GraduationCap, MessageCircleQuestion, Send, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askDoubt, teachKnowa } from "@/app/actions/tutor";
import { MAX_DOUBT, MAX_EXPLANATION, type TeachReply } from "@/lib/tutor";
import { ReadAloud, VoiceInput } from "./speech";
import { Alert, Button, Card, cn, Input, Textarea } from "./ui";

type LessonLink = { id: string; title: string } | null;
type Msg = { who: "you" | "tutor"; text: string; photo?: string; notes?: { title: string; chapter: string }[]; fromNotes?: boolean; lesson?: LessonLink };

/** "See it in 3D": the narrated lesson that fits what the tutor just explained. */
function LessonLinkCard({ classroomId, lesson }: { classroomId: string; lesson: NonNullable<LessonLink> }) {
  return (
    <Link href={`/classes/${classroomId}/explain/lesson/${lesson.id}`} data-testid="tutor-3d-lesson"
      className="mt-2 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-surface px-3 py-2 text-text hover:border-primary/60">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#0d1530] text-[#9db3ff]"><Box className="size-4" aria-hidden /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs text-muted">See it in 3D</span><span className="block truncate text-sm font-medium">{lesson.title}</span></span>
      <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
    </Link>
  );
}

/** Downscales a photo in the browser (max 1280 px) and re-encodes it as JPEG (which also drops its metadata). */
async function prepPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/**
 * The AI tutor (guarded): ask a doubt, with a photo if you like, answered from your class's approved notes;
 * or "Teach Knowa" a topic in your own words. Nothing you type or send is saved.
 */
export function Tutor({ classroomId, blocked, topics }: { classroomId: string; blocked: string | null; topics: string[] }) {
  const [tab, setTab] = useState<"ask" | "teach">("ask");
  return (
    <div className="space-y-4" data-testid="tutor">
      <div className="flex flex-wrap items-center gap-2">
        {([["ask", "Ask a doubt", MessageCircleQuestion], ["teach", "Teach Knowa", GraduationCap]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-medium", tab === k ? "border-primary/30 bg-primary-soft text-primary" : "border-border text-muted hover:text-text")}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> Answers use your class&apos;s approved notes. Don&apos;t write names, phone numbers or addresses, and photograph only the question (no faces). Nothing you type or send is saved. The AI can make mistakes.</p>
      {blocked ? <Alert tone="warn">{blocked}</Alert> : tab === "ask" ? <Ask classroomId={classroomId} /> : <Teach classroomId={classroomId} topics={topics} />}
    </div>
  );
}

function Ask({ classroomId }: { classroomId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs, busy]);
  const lastQ = [...msgs].reverse().find((m) => m.who === "you")?.text ?? "";

  const send = async (text: string, pic: string | null) => {
    const question = text.trim();
    if ((!question && !pic) || busy) return;
    setError(null); setBusy(true);
    setMsgs((m) => [...m, { who: "you", text: question || "(a photo of my question)", photo: pic ?? undefined }]);
    setQ(""); setPhoto(null);
    const res = await askDoubt(classroomId, { question, photo: pic }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check your connection." }));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setMsgs((m) => [...m, { who: "tutor", text: res.data!.answer, notes: res.data!.notes, fromNotes: res.data!.fromNotes, lesson: res.data!.lesson }]);
  };

  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="tutor-chat" aria-live="polite">
        {msgs.length === 0 && <p className="text-sm text-muted">Stuck on something? Ask here, in your own words, or send a photo of the question. I&apos;ll explain it simply, using your class notes.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.who === "you" ? "ml-auto bg-primary text-primary-fg" : "bg-surface-2")} data-testid={m.who === "you" ? "tutor-you" : "tutor-answer"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL the student just picked */}
            {m.photo && <img src={m.photo} alt="Your photo" className="mb-2 max-h-40 rounded-lg" />}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.who === "tutor" && (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {m.notes && m.notes.length > 0 && <span>From your notes: {m.notes.map((n) => n.title).join(", ")}</span>}
                <ReadAloud text={m.text} className="px-0 py-0" />
              </div>
            )}
            {m.who === "tutor" && m.lesson && <LessonLinkCard classroomId={classroomId} lesson={m.lesson} />}
          </div>
        ))}
        {busy && <p className="text-sm text-muted" data-testid="tutor-thinking">Thinking…</p>}
        <div ref={endRef} />
      </div>
      {error && <div className="px-4"><Alert tone="warn">{error}</Alert></div>}
      {msgs.length > 0 && !busy && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          {[["Explain simpler", `Explain this again in simpler words, with an everyday example: ${lastQ}`], ["Another example", `Give me one more worked example of: ${lastQ}`], ["Why?", `Why is that true? Explain the reason: ${lastQ}`]].map(([l, t]) => (
            <button key={l} type="button" onClick={() => send(t.slice(0, MAX_DOUBT), null)} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-primary hover:border-primary/40">{l}</button>
          ))}
        </div>
      )}
      <form className="space-y-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(q, photo); }}>
        {photo && (
          <div className="flex items-center gap-2 rounded-xl border border-border p-2 text-xs text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
            <img src={photo} alt="" className="size-10 rounded object-cover" /> Photo ready. Add a question, or just send it.
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" className="ml-auto rounded p-1 hover:bg-surface-2"><X className="size-4" /></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={MAX_DOUBT} placeholder="Type your doubt…" aria-label="Your doubt" className="flex-1" />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a photo" title="Attach a photo of the question" className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-muted hover:text-text"><Camera className="size-4" /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden data-testid="tutor-photo" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { try { setPhoto(await prepPhoto(f)); } catch { setError("That picture couldn't be opened. Try another one."); } } }} />
          <Button type="submit" loading={busy} disabled={!q.trim() && !photo} data-testid="tutor-send"><Send className="size-4" /> Ask</Button>
        </div>
        <VoiceInput onText={(t) => setQ((v) => `${v}${v ? " " : ""}${t}`.slice(0, MAX_DOUBT))} />
      </form>
    </Card>
  );
}

function Teach({ classroomId, topics }: { classroomId: string; topics: string[] }) {
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rounds, setRounds] = useState<{ you: string; reply: TeachReply & { lesson?: LessonLink } }[]>([]);
  const history = rounds.flatMap((r) => [`Student: ${r.you}`, `Classmate: ${r.reply.say}${r.reply.question ? ` Question: ${r.reply.question}` : ""}`]);
  const submit = async () => {
    if (busy) return; setError(null); setBusy(true);
    const res = await teachKnowa(classroomId, { topic, explanation: text, history }).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setRounds((r) => [...r, { you: text.trim(), reply: res.data! }]); setText("");
  };
  const last = rounds.at(-1)?.reply;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="space-y-3 p-4">
        <div className="rounded-xl bg-primary-soft p-3 text-sm"><b className="text-primary">The best way to learn is to teach.</b> Explain a topic to me as if I&apos;m in a lower class. I&apos;ll tell you what clicked, what&apos;s missing, and ask you one question.</div>
        <Input value={topic} onChange={(e) => { setTopic(e.target.value); setRounds([]); }} maxLength={90} placeholder="Topic you'll teach, e.g. Friction" aria-label="Topic" />
        {topics.length > 0 && <div className="flex flex-wrap gap-1.5">{topics.map((t) => <button key={t} type="button" onClick={() => { setTopic(t); setRounds([]); }} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-primary/40 hover:text-text">{t}</button>)}</div>}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={MAX_EXPLANATION} placeholder={last?.question ? "Answer my question here…" : "Explain it in your own words…"} aria-label="Your explanation" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VoiceInput onText={(t) => setText((v) => `${v}${v ? " " : ""}${t}`.slice(0, MAX_EXPLANATION))} />
          <Button onClick={submit} loading={busy} disabled={topic.trim().length < 2 || text.trim().length < 8} data-testid="teach-send"><Sparkles className="size-4" /> Teach Knowa</Button>
        </div>
        {error && <Alert tone="warn">{error}</Alert>}
      </Card>
      <div className="space-y-3" aria-live="polite">
        {rounds.length === 0 && <Card className="p-5 text-sm text-muted">My feedback appears here.</Card>}
        {rounds.map((r, i) => (
          <Card key={i} className="space-y-2 p-4" data-testid="teach-result">
            <p className="flex gap-0.5" aria-label={`${r.reply.stars} out of 5 stars`}>{Array.from({ length: 5 }, (_, k) => <Star key={k} className={cn("size-5", k < r.reply.stars ? "fill-warn text-warn" : "text-border-strong")} />)}</p>
            <p className="text-sm">{r.reply.say}</p>
            {r.reply.got.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-success">You explained well</p><ul className="list-inside list-disc text-sm">{r.reply.got.map((g, k) => <li key={k}>{g}</li>)}</ul></div>}
            {r.reply.missing.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wider text-warn">Still missing</p><ul className="space-y-1 text-sm">{r.reply.missing.map((m, k) => <li key={k}><b>{m.gap}</b> <span className="text-muted">{m.fix}</span></li>)}</ul></div>}
            {r.reply.question && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm"><b>Knowa asks:</b> {r.reply.question}</p>}
            <ReadAloud text={`${r.reply.say} ${r.reply.question}`} className="px-0" />
            {r.reply.lesson && <LessonLinkCard classroomId={classroomId} lesson={r.reply.lesson} />}
          </Card>
        ))}
      </div>
    </div>
  );
}
