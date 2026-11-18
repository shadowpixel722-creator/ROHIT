"use client";

import { Mic, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "./ui";

/** Reads text aloud with the browser's own voice (on the device; nothing is sent). Tap again to stop. */
export function ReadAloud({ text, label = "Read aloud", className }: { text: string; label?: string; className?: string }) {
  const [on, setOn] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(typeof window !== "undefined" && "speechSynthesis" in window); return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }; }, []);
  if (!ok || !text.trim()) return null;
  const toggle = () => {
    const ss = window.speechSynthesis;
    if (on) { ss.cancel(); setOn(false); return; }
    ss.cancel();
    const parts = text.replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g) ?? [text];
    const voices = ss.getVoices().filter((v) => /^en/i.test(v.lang));
    const voice = voices.find((v) => /en[-_]IN/i.test(v.lang)) ?? voices[0];
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p.trim()); if (voice) u.voice = voice;
      if (i === parts.length - 1) { u.onend = () => setOn(false); u.onerror = () => setOn(false); }
      ss.speak(u);
    });
    setOn(true);
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={on} data-testid="read-aloud"
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text", on && "text-primary", className)}>
      {on ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />} {on ? "Stop reading" : label}
    </button>
  );
}

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void; onerror: () => void; onend: () => void };

/**
 * A microphone button that turns speech into text and adds it (via `onText`). Uses the browser's speech
 * recognition, which in some browsers (for example Chrome) sends the audio to the browser maker's speech
 * service; the button says so. Hidden where the browser can't do it.
 */
export function VoiceInput({ onText, className }: { onText: (text: string) => void; className?: string }) {
  const [live, setLive] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (live) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const R = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const r = new R(); rec.current = r;
    r.lang = "en-IN"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript; if (t.trim()) onText(t.trim()); };
    r.onerror = () => setLive(false);
    r.onend = () => setLive(false);
    try { r.start(); setLive(true); } catch { setLive(false); }
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={live} data-testid="voice-input"
      title="Speak instead of typing. Your browser may send your voice to its speech service to turn it into text."
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium", live ? "bg-danger-soft text-danger" : "text-muted hover:bg-surface-2 hover:text-text", className)}>
      <Mic className="size-3.5" /> {live ? "Listening… tap to stop" : "Speak"}
    </button>
  );
}
