"use client";

import { ArrowLeft, CheckCircle2, Gauge, Maximize2, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lessonFinished } from "@/app/actions/game";
import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonNote, LessonQuiz, LessonStep, LessonVisual } from "@/lib/knowa/lessons";
import { Button, Card, cn } from "../ui";

/**
 * Plays a narrated lesson like a tutor at your desk: it speaks each step (the browser's own voice, on the
 * device; captions if there is no voice), writes on the notepad, moves the 3D model's sliders with its own
 * cursor and points at parts. Pause, step back or forward, change speed, or take over the model at any time.
 * Lessons without a model play on the notepad alone (e.g. a class explanation read aloud).
 */
export function LessonPlayer({ lesson, backHref, backLabel = "Back", onFinish, classroomId }: {
  lesson: Lesson; backHref: string; backLabel?: string;
  /** Finishing the lesson in this class earns XP (once per lesson per day) and counts towards the streak. */
  classroomId?: string;
  /** Called once when the lesson ends (and again with the quiz score once the check is done). */
  onFinish?: (r: { quiz?: { right: number; total: number } }) => void;
}) {
  const hasModel = lesson.steps.some((s) => s.model);
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the ported stage is untyped
  const stageRef = useRef<any>(null);
  const run = useRef({ token: 0, paused: false, speed: 1 });
  const [ready, setReady] = useState(!hasModel);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "done">("idle");
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceRef = useRef(true);
  const [caption, setCaption] = useState<{ sents: string[]; on: number }>({ sents: [lesson.blurb], on: -1 });
  const [modelId, setModelId] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "quiz">("notes");
  const [full, setFull] = useState(false);
  const finished = useRef(false);

  /* ── the 3D stage, loaded only here ── */
  useEffect(() => {
    if (!hasModel) return;
    let alive = true;
    (async () => {
      const [THREE, { createModels }, { createStage }] = await Promise.all([import("three"), import("@/lib/knowa/models"), import("@/lib/knowa/stage")]);
      if (!alive || !boxRef.current) return;
      const st = createStage(THREE, createModels(THREE), { box: boxRef.current, canvas: canvasRef.current!, tags: tagsRef.current!, controls: ctlRef.current!, readout: readRef.current! });
      if (!st.ok) { setFailed(true); setReady(true); return }
      st.onUser = () => { if (run.current.token && stateRef.current === "playing") pause(); };
      st.onModel = (id: string) => setModelId(id);
      st.load("idle");
      stageRef.current = st;
      setReady(true);
    })().catch(() => { if (alive) { setFailed(true); setReady(true) } });
    return () => { alive = false; stageRef.current?.destroy(); stageRef.current = null; };
  }, [hasModel]);

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on unmount
  useEffect(() => () => { run.current.token++; stopVoice(); }, []);

  /* ── timing helpers ── */
  const sleep = (ms: number, tok: number) => new Promise<void>((res) => {
    let t = 0;
    const tick = () => { if (tok !== run.current.token) return res(); if (!run.current.paused) t += 50; if (t >= ms) return res(); setTimeout(tick, 50); };
    tick();
  });
  const alive = (tok: number) => tok === run.current.token;

  /* ── the tutor's cursor ── */
  const cur = useRef({ x: 0, y: 0 });
  const placeCursor = (x: number, y: number, dur: number) => {
    const c = cursorRef.current; if (!c) return;
    c.style.transition = `transform ${dur}ms cubic-bezier(.45,0,.2,1), opacity .3s`;
    c.style.transform = `translate(${x}px, ${y}px)`; c.style.opacity = "1"; cur.current = { x, y };
  };
  const cursorTo = async (target: Element | { x: number; y: number } | null, tok: number) => {
    if (!target) return;
    let p: { x: number; y: number } | null = null;
    if (target instanceof Element) { const r = target.getBoundingClientRect(); if (r.width || r.height) p = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } else p = target;
    if (!p) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dist = Math.hypot(p.x - cur.current.x, p.y - cur.current.y), dur = reduce ? 10 : Math.min(900, 220 + dist * .7);
    placeCursor(p.x, p.y, dur);
    await sleep(dur + 30, tok);
  };
  const ripple = () => {
    const r = document.createElement("div"); r.className = "ks-ripple"; r.style.left = cur.current.x + "px"; r.style.top = cur.current.y + "px";
    document.body.appendChild(r); setTimeout(() => r.remove(), 650);
  };
  const cursorClick = async (target: Element | { x: number; y: number } | null, tok: number, fn?: () => void) => {
    await cursorTo(target, tok); if (!alive(tok)) return; ripple(); await sleep(150, tok); if (alive(tok)) fn?.();
  };
  const hideCursor = () => { if (cursorRef.current) cursorRef.current.style.opacity = "0"; };

  /* ── voice: the browser's speech synthesis (on the device), or timed captions ── */
  const speechOK = typeof window !== "undefined" && "speechSynthesis" in window;
  const voiceBad = useRef(false);
  function stopVoice() { try { if (speechOK) window.speechSynthesis.cancel(); } catch { /* ignore */ } }
  const pickVoice = () => {
    try {
      const vs = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
      return vs.find((v) => /en[-_]IN/i.test(v.lang)) ?? vs.find((v) => /en[-_](GB|US)/i.test(v.lang)) ?? vs[0] ?? null;
    } catch { return null; }
  };
  const sayOne = (text: string, tok: number) => new Promise<boolean>((res) => {
    const ss = window.speechSynthesis; let started = false, done = false;
    const fin = () => { if (done) return; done = true; clearInterval(poll); clearTimeout(cap); res(started); };
    try {
      const u = new SpeechSynthesisUtterance(text), v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 1.02 * run.current.speed; u.onstart = () => { started = true; }; u.onend = fin; u.onerror = fin;
      ss.cancel(); ss.resume(); ss.speak(u);
    } catch { fin(); }
    const t0 = performance.now();
    const poll = setInterval(() => {
      if (!alive(tok)) { try { ss.cancel(); } catch { /* ignore */ } fin(); }
      else if (run.current.paused) { try { ss.pause(); } catch { /* ignore */ } }
      else { try { ss.resume(); } catch { /* ignore */ } if (!started && !ss.speaking && !ss.pending && performance.now() - t0 > 1500) fin(); }
    }, 120);
    const cap = setTimeout(fin, Math.max(8000, text.length * 170));
  });
  const speak = async (text: string, tok: number) => {
    const sents = (text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
    setCaption({ sents, on: 0 });
    for (let i = 0; i < sents.length; i++) {
      if (!alive(tok)) return;
      setCaption({ sents, on: i });
      let spoken = false;
      if (voiceRef.current && speechOK && !voiceBad.current) { spoken = await sayOne(sents[i], tok); if (!spoken && i === 0) voiceBad.current = true; }
      if (!spoken) await sleep(Math.max(1300, sents[i].length * 55) / run.current.speed, tok);
    }
  };

  /* ── lesson notes: one card per step, built up as the tutor talks ── */
  const [cards, setCards] = useState<NoteCard[]>([]);
  const cardsRef = useRef<NoteCard[]>([]);
  const putCards = (c: NoteCard[]) => { cardsRef.current = c; setCards(c); };
  const clearPad = () => putCards([]);
  /** Adds a step's note (or adds to the previous card with `same`). Live, its lines appear one by one. */
  const writeNote = async (note: LessonNote, tok: number | null, step: number) => {
    const live = tok !== null && alive(tok);
    const prev = cardsRef.current;
    const merge = note.same && prev.length > 0;
    const base: NoteCard = merge ? { ...prev[prev.length - 1], step } : { key: `${step}-${prev.length}`, step, title: note.title ?? "Note", lines: [], code: [], mark: note.mark ?? [] };
    const full: NoteCard = { ...base, lines: [...base.lines, ...(note.lines ?? [])], code: [...base.code, ...(note.code ?? [])], mark: note.mark ?? base.mark, formula: note.formula ?? base.formula, visual: note.visual ?? base.visual };
    const list = merge ? [...prev.slice(0, -1), full] : [...prev, full];
    if (!live) { putCards(list); return; }
    // Reveal the new lines one at a time, paced like speech.
    const shown = { ...full, lines: base.lines, code: base.code, formula: base.formula, visual: base.visual };
    putCards(merge ? [...prev.slice(0, -1), shown] : [...prev, shown]);
    for (const l of note.lines ?? []) { await sleep(Math.max(500, l.length * 28) / run.current.speed, tok!); if (!alive(tok!)) return; shown.lines = [...shown.lines, l]; putCards([...cardsRef.current.slice(0, -1), { ...shown }]); }
    if (note.code?.length) { await sleep(400, tok!); shown.code = full.code; putCards([...cardsRef.current.slice(0, -1), { ...shown }]); }
    if (note.visual || note.formula) { await sleep(400, tok!); putCards([...cardsRef.current.slice(0, -1), { ...full }]); }
    else putCards([...cardsRef.current.slice(0, -1), full]);
  };

  /* ── the director ── */
  const setParam = async (id: string, val: number | string, tok: number) => {
    const st = stageRef.current; const d = st?.def; if (!d) return;
    const p = d.params.find((q: { id: string }) => q.id === id); if (!p) return;
    if (p.type === "choice") { if (String(st.params[id]) === String(val)) return; await cursorClick(st.controlEl(id, val), tok, () => st.set(id, val)); return; }
    const from = st.params[id] as number; const to = Math.min(p.max, Math.max(p.min, Number(val)));
    if (Math.abs(from - to) < 1e-6) return;
    const th = st.sliderThumb(id); if (!th) { st.set(id, to); return; }
    await cursorTo(th, tok); if (!alive(tok)) return;
    const dur = (600 + Math.abs(to - from) / (p.max - p.min) * 2200) / run.current.speed;
    let el = 0, last = performance.now();
    await new Promise<void>((res) => {
      const f = () => {
        if (!alive(tok)) return res();
        const n = performance.now(); if (!run.current.paused) el += n - last; last = n;
        const k = Math.min(1, el / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        let v = from + (to - from) * e; if (p.step >= 1) v = Math.round(v);
        st.set(id, k >= 1 ? to : v);
        const t = st.sliderThumb(id); if (t) placeCursor(t.x, t.y, 60);
        if (k < 1) requestAnimationFrame(f); else res();
      };
      f();
    });
  };
  const doStep = async (s: LessonStep, tok: number) => {
    const st = stageRef.current;
    const speech = speak(s.say, tok);
    const work = (async () => {
      if (s.model && st && s.model !== st.id) { await cursorClick(document.querySelector(`[data-ks-model="${s.model}"]`), tok, () => st.load(s.model)); if (!alive(tok)) return; }
      if (s.note) { await writeNote(s.note, tok, lesson.steps.indexOf(s)); if (!alive(tok)) return; }
      if (s.set && st) for (const [k, v] of Object.entries(s.set)) { if (!alive(tok)) return; await setParam(k, v, tok); }
      if (!alive(tok) || !st) return;
      if (s.view) st.go(s.view);
      if ("focus" in s) {
        if (s.focus) {
          st.focus(s.focus); if (!s.view) st.frame(s.focus);
          await sleep(650, tok); if (!alive(tok)) return;
          const pos = st.screenPosOf(s.focus); if (pos && st.partVisible(s.focus)) await cursorClick(pos, tok);
        } else st.focus(null);
      }
    })();
    await Promise.all([speech, work]);
  };
  /** Fast-forwards to step `from` without animation: models, sliders and notes as they would be. */
  const replayTo = (from: number) => {
    clearPad(); cardsRef.current = []; const st = stageRef.current;
    for (let j = 0; j < from; j++) {
      const s = lesson.steps[j];
      if (st && s.model && s.model !== st.id) st.load(s.model);
      if (st && s.set) for (const [k, v] of Object.entries(s.set)) st.set(k, v);
      if (s.note) void writeNote(s.note, null, j);
    }
    const prev = lesson.steps[from - 1]; if (st && prev?.view) st.go(prev.view, true);
  };
  const start = async (from = 0) => {
    const tok = ++run.current.token; run.current.paused = false; stopVoice();
    setState("playing"); setTab("notes");
    if (from === 0) { clearPad(); stageRef.current?.focus(null); } else replayTo(from);
    for (let i = from; i < lesson.steps.length; i++) {
      if (!alive(tok)) return;
      setStep(i);
      await doStep(lesson.steps[i], tok);
      if (!alive(tok)) return;
      await sleep(380, tok);
    }
    if (!alive(tok)) return;
    setState("done"); hideCursor();
    const st = stageRef.current; if (st?.def?.params.some((p: { id: string }) => p.id === "run")) st.set("run", 0);
    if (!finished.current) {
      finished.current = true; onFinish?.({});
      if (classroomId) void lessonFinished(classroomId, lesson.id).then((r) => { if (r.ok) router.refresh(); }).catch(() => {});
    }
    await speak(lesson.quiz.length ? "That is the lesson done. Try the quick check, or replay any step." : "That is the lesson done. Replay any step, or go back to your class.", tok);
    if (lesson.quiz.length && alive(tok)) setTab("quiz");
  };

  function pause() { run.current.paused = true; setState("paused"); try { window.speechSynthesis?.pause(); } catch { /* ignore */ } }
  const resume = () => { run.current.paused = false; setState("playing"); try { window.speechSynthesis?.resume(); } catch { /* ignore */ } };
  const goTo = (i: number) => start(Math.max(0, Math.min(lesson.steps.length - 1, i)));
  const cycleSpeed = () => { const n = speed === 1 ? 1.25 : speed === 1.25 ? 0.8 : 1; setSpeed(n); run.current.speed = n; };
  const toggleVoice = () => { const n = !voiceOn; setVoiceOn(n); voiceRef.current = n; voiceBad.current = false; if (!n) stopVoice(); };

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
      if (e.key === " " && state !== "idle" && state !== "done") { e.preventDefault(); if (state === "playing") pause(); else resume(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const models = [...new Set(lesson.steps.map((s) => s.model).filter(Boolean))] as string[];
  const playing = state === "playing";

  const current = cards.length ? cards[cards.length - 1] : null;
  const earlier = cards.slice(0, -1).reverse();
  const short = (t: string) => (t.length <= 48 ? t : `${t.slice(0, t.lastIndexOf(" ", 46) > 20 ? t.lastIndexOf(" ", 46) : 46).replace(/[,;:]$/, "")}…`);
  const outline = lesson.steps.map((st, i) => (st.note?.title && !st.note.same ? st.note.title : short(st.say.match(/^[^.!?]+/)?.[0] ?? `Step ${i + 1}`)));

  const transport = (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
      {state === "idle" ? (
        <Button onClick={() => start(0)} disabled={!ready} data-testid="lesson-start"><Play className="size-4" /> Start the lesson</Button>
      ) : (
        <>
          <IconBtn label="Previous step" onClick={() => goTo(step - 1)}><SkipBack className="size-4" /></IconBtn>
          {state === "done"
            ? <Button size="sm" onClick={() => start(0)} data-testid="lesson-replay"><Play className="size-4" /> Replay</Button>
            : <IconBtn label={playing ? "Pause" : "Resume"} onClick={() => (playing ? pause() : resume())} testId="lesson-pause">{playing ? <Pause className="size-4" /> : <Play className="size-4" />}</IconBtn>}
          <IconBtn label="Next step" onClick={() => goTo(step + 1)}><SkipForward className="size-4" /></IconBtn>
        </>
      )}
      <div className="flex flex-1 items-center gap-1 overflow-hidden px-2" aria-label={`Step ${step + 1} of ${lesson.steps.length}`}>
        {lesson.steps.map((_, i) => (
          <button key={i} type="button" aria-label={`Go to step ${i + 1}`} onClick={() => state !== "idle" && goTo(i)}
            className={cn("h-1.5 flex-1 rounded-full transition-colors", state === "idle" ? "bg-border" : i < step || state === "done" ? "bg-primary" : i === step ? "bg-warn" : "bg-border")} />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted" data-testid="lesson-step">{state === "idle" ? `${lesson.steps.length} steps` : `Step ${Math.min(step + 1, lesson.steps.length)} of ${lesson.steps.length}`}</span>
      <button type="button" onClick={cycleSpeed} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text" aria-label="Change speed"><Gauge className="size-3.5" /> {speed}×</button>
      {lesson.quiz.length > 0 && <Button size="sm" variant={tab === "quiz" ? "primary" : "secondary"} onClick={() => setTab(tab === "quiz" ? "notes" : "quiz")} data-testid="lesson-quiz-tab">Quick check</Button>}
    </div>
  );

  return (
    <div className={cn("space-y-3", full && "fixed inset-0 z-[70] overflow-y-auto bg-bg p-3 sm:p-5")} data-testid="lesson-player" data-state={state} data-step={step}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> {backLabel}</Link>
        <span className="text-xs text-faint">·</span>
        <span className="text-sm font-semibold">{lesson.title}</span>
        <span className="ml-auto flex items-center gap-1">
          <IconBtn label={voiceOn ? "Turn voice off" : "Turn voice on"} onClick={toggleVoice}>{voiceOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</IconBtn>
          <IconBtn label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</IconBtn>
        </span>
      </div>

      {hasModel ? (
        <>
          {/* The 3D model is the main thing: full width and tall. */}
          <div ref={boxRef} className={cn("ks-stage relative overflow-hidden rounded-2xl", full ? "h-[72vh]" : "h-[min(72vh,680px)] min-h-[340px]")} data-testid="lesson-stage" data-ready={ready && !failed ? "true" : "false"}>
            <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" aria-label="Interactive 3D model. Drag to turn, scroll or pinch to zoom." />
            <div ref={tagsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
            <div ref={readRef} className="ks-readout" data-testid="lesson-readout" style={{ display: "none" }} />
            {models.length > 1 && (
              <div className="absolute right-3 top-3 flex gap-1.5">
                {models.map((m) => <button key={m} type="button" data-ks-model={m} onClick={() => stageRef.current?.load(m)} className={cn("ks-chip", modelId === m && "on")}>{m}</button>)}
              </div>
            )}
            {models.length === 1 && <span data-ks-model={models[0]} className="absolute right-4 top-4 size-1" aria-hidden />}
            {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">3D isn&apos;t available in this browser. The notes and voice still work.</p>}
            {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Loading the 3D model…</p>}
            <Captions caption={caption} />
          </div>
          <div ref={ctlRef} className="ks-controls" data-testid="lesson-controls" />
        </>
      ) : (
        <Card className="p-0"><Captions caption={caption} inline /></Card>
      )}

      {transport}

      {tab === "quiz" ? (
        <Card className="overflow-hidden"><Quiz quiz={lesson.quiz} onDone={(right, total) => onFinish?.({ quiz: { right, total } })} /></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="space-y-3" data-testid="lesson-notepad" aria-label="Lesson notes" aria-live="polite">
            {!current ? (
              <Card className="p-5 text-sm text-muted">{state === "idle" ? "Start the lesson: the key points for each step appear here as the tutor explains." : "Listen and watch the model…"}</Card>
            ) : (
              <NoteCardView card={current} now />
            )}
            {earlier.length > 0 && (
              <details className="rounded-2xl border border-border bg-surface" open={earlier.length <= 2}>
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted">Earlier notes ({earlier.length})</summary>
                <div className="space-y-2 px-3 pb-3">{earlier.map((c) => <NoteCardView key={c.key} card={c} />)}</div>
              </details>
            )}
          </section>
          <nav aria-label="Lesson steps" className="h-fit rounded-2xl border border-border bg-surface p-2">
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Steps</p>
            <ol>
              {outline.map((t, i) => {
                const on = state !== "idle" && i === step, done = state === "done" || (state !== "idle" && i < step);
                return (
                  <li key={i}>
                    <button type="button" onClick={() => goTo(i)} aria-current={on ? "step" : undefined}
                      className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm", on ? "bg-primary-soft font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
                      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", done ? "bg-primary text-primary-fg" : on ? "bg-warn text-white" : "bg-surface-2 text-faint")}>{done ? <CheckCircle2 className="size-3" /> : i + 1}</span>
                      <span className="min-w-0 flex-1 leading-snug">{t}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      )}

      <div ref={cursorRef} className="ks-cursor" aria-hidden>
        <svg viewBox="0 0 30 30"><path d="M4 3l20 9-8.5 2.5L12 23z" /></svg><span>Tutor</span>
      </div>
    </div>
  );
}

type NoteCard = { key: string; step: number; title: string; lines: string[]; code: string[]; mark: number[]; formula?: string; visual?: LessonVisual };

/** One step's notes: a clean card with the key points, a formula, code or a small table. */
function NoteCardView({ card, now }: { card: NoteCard; now?: boolean }) {
  const mk = new Set(card.mark);
  const bold = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i} className="font-semibold text-primary">{part}</b> : part));
  return (
    <article className={cn("rounded-2xl border bg-surface", now ? "border-primary/30 p-5 shadow-card" : "border-border p-4")} data-testid={now ? "lesson-note-now" : "lesson-note"}>
      <header className="flex items-center gap-2">
        <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-semibold", now ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted")}>{card.step + 1}</span>
        <h3 className={cn("font-semibold", now ? "text-base" : "text-sm")}>{card.title}</h3>
        {now && <span className="ml-auto text-[11px] font-medium uppercase tracking-wider text-primary">Now</span>}
      </header>
      {card.lines.length > 0 && (
        <ul className={cn("mt-3 space-y-1.5", !now && "text-sm")}>
          {card.lines.map((l, i) => <li key={i} className="ks-line flex gap-2.5"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /><span>{bold(l)}</span></li>)}
        </ul>
      )}
      {card.code.length > 0 && <pre className="ks-code">{card.code.map((l, i) => <span key={i} className={cn("ln", mk.has(i + 1) && "mk")}>{l}</span>)}</pre>}
      {card.visual && <VisualView v={card.visual} />}
      {card.formula && <p className="ks-formula">{card.formula}</p>}
    </article>
  );
}

function VisualView({ v }: { v: LessonVisual }) {
  return (
    <div className="ks-visual">
      {v.type === "table" ? (
        <table>
          {v.head?.length ? <thead><tr>{v.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead> : null}
          <tbody>{v.rows.map((r, i) => <tr key={i}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
        </table>
      ) : (
        <div className="ks-flow">{v.boxes.map((b, i) => <span key={i} className="contents">{i > 0 && <span className="arrow">→</span>}<span className="box">{b}</span></span>)}</div>
      )}
      {v.caption && <p className="cap">{v.caption}</p>}
    </div>
  );
}

function Captions({ caption, inline }: { caption: { sents: string[]; on: number }; inline?: boolean }) {
  return (
    <div className={cn(inline ? "px-4 py-3" : "ks-caption")} aria-live="polite" data-testid="lesson-caption">
      <p className={cn("leading-relaxed", inline ? "text-[15px]" : "text-[15px] sm:text-base")}>
        {caption.sents.map((s, i) => (
          <span key={i} className={cn("transition-colors", i === caption.on ? "ks-on" : i < caption.on ? "ks-past" : "ks-later")}>{s} </span>
        ))}
      </p>
    </div>
  );
}

function Quiz({ quiz, onDone }: { quiz: LessonQuiz[]; onDone: (right: number, total: number) => void }) {
  const [picked, setPicked] = useState<(number | null)[]>(quiz.map(() => null));
  const answered = picked.filter((p) => p !== null).length;
  const right = picked.filter((p, i) => p === quiz[i].answer).length;
  const reported = useRef(false);
  useEffect(() => { if (answered === quiz.length && !reported.current) { reported.current = true; onDone(right, quiz.length); } }, [answered, right, quiz.length, onDone]);
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" data-testid="lesson-quiz">
      <p className="text-sm text-muted">{answered === quiz.length ? <b className="text-text">You got {right} of {quiz.length}.</b> : "A quick check on this lesson. Nothing here is marked by AI or seen by anyone else."}</p>
      {quiz.map((q, qi) => (
        <div key={qi} className="rounded-xl border border-border p-3">
          <p className="text-sm font-medium">{qi + 1}. {q.q}</p>
          <div className="mt-2 space-y-1.5">
            {q.options.map((o, oi) => {
              const done = picked[qi] !== null, isRight = done && oi === q.answer, isWrong = done && picked[qi] === oi && oi !== q.answer;
              return (
                <button key={oi} type="button" disabled={done} onClick={() => setPicked((p) => p.map((x, k) => (k === qi ? oi : x)))}
                  className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm", !done && "border-border hover:bg-surface-2",
                    isRight && "border-success/50 bg-success-soft text-success", isWrong && "border-danger/50 bg-danger-soft text-danger", done && !isRight && !isWrong && "border-border opacity-60")}>
                  <span className="flex-1">{o}</span>{isRight && <CheckCircle2 className="size-4" />}{isWrong && <XCircle className="size-4" />}
                </button>
              );
            })}
          </div>
          {picked[qi] !== null && <p className="mt-2 text-xs text-muted">{picked[qi] === q.answer ? "Correct. " : "Not quite. "}{q.why}</p>}
        </div>
      ))}
    </div>
  );
}

function IconBtn({ label, onClick, children, testId }: { label: string; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} data-testid={testId} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text">{children}</button>;
}
