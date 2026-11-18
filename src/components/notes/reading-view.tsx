"use client";

import { Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../ui";

const SIZES = [0.85, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5];
const KEY = "explain:text-size";

function savedSize() {
  try {
    const v = Number(localStorage.getItem(KEY));
    return SIZES.includes(v) ? v : 1;
  } catch {
    return 1;
  }
}

/**
 * Wraps one lesson's explanation for reading: a text-size control (remembered on this device) and a full-screen
 * mode. Full screen is a fixed layer over the app (works on every phone) and, where the browser allows it, real
 * full screen too. The content stays the same DOM, so the key-point highlights keep working.
 */
export function ReadingView({ title, children }: { title: string; children: React.ReactNode }) {
  const [full, setFull] = useState(false);
  const [size, setSize] = useState(1);
  useEffect(() => setSize(savedSize()), []);

  const changeSize = useCallback((next: number) => {
    setSize(next);
    try { localStorage.setItem(KEY, String(next)); } catch { /* private mode: just not remembered */ }
  }, []);
  const step = useCallback((dir: 1 | -1) => {
    const i = SIZES.indexOf(size);
    changeSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, (i === -1 ? 1 : i) + dir))]);
  }, [size, changeSize]);

  const close = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  function open() {
    setFull(true);
    document.documentElement.requestFullscreen?.().catch(() => {}); // not on iPhone: the fixed layer still fills the screen
  }

  useEffect(() => {
    if (!full) return;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Leaving the browser's full screen (Esc, swipe) closes the reader too.
    const onFs = () => { if (!document.fullscreenElement) setFull(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") step(1);
      else if (e.key === "-") step(-1);
      else if (e.key === "0") changeSize(1);
    };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = body;
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
    };
  }, [full, close, step, changeSize]);

  const controls = (
    <div className="flex items-center gap-1" data-testid="reading-toolbar">
      <div className="flex items-center rounded-xl border border-border bg-surface" role="group" aria-label="Text size">
        <button type="button" onClick={() => step(-1)} disabled={size === SIZES[0]} aria-label="Smaller text" data-testid="text-smaller"
          className="grid h-8 w-9 place-items-center rounded-l-xl text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40">A−</button>
        <span className="min-w-12 text-center text-xs tabular-nums text-muted" data-testid="text-size" aria-live="polite">{Math.round(size * 100)}%</span>
        <button type="button" onClick={() => step(1)} disabled={size === SIZES[SIZES.length - 1]} aria-label="Bigger text" data-testid="text-bigger"
          className="grid h-8 w-9 place-items-center rounded-r-xl text-base font-semibold text-muted hover:bg-surface-2 hover:text-text disabled:opacity-40">A+</button>
      </div>
      {size !== 1 && (
        <button type="button" onClick={() => changeSize(1)} aria-label="Reset text size" title="Reset text size"
          className="grid size-8 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"><RotateCcw className="size-4" /></button>
      )}
      {full ? (
        <button type="button" onClick={close} data-testid="exit-fullscreen"
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          <Minimize2 className="size-4" /><span className="hidden sm:inline">Exit full screen</span><X className="size-4 sm:hidden" aria-label="Close" />
        </button>
      ) : (
        <button type="button" onClick={open} data-testid="read-fullscreen"
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2">
          <Maximize2 className="size-4" /> Full screen
        </button>
      )}
    </div>
  );

  return (
    <div
      className={cn(full && "fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-bg print:static")}
      role={full ? "dialog" : undefined} aria-modal={full || undefined} aria-label={full ? `Reading: ${title}` : undefined}
      data-testid="reading-view" data-full={full ? "true" : "false"}>
      <div className={cn(full ? "sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur" : "mb-3")}>
        <div className={cn("flex flex-wrap items-center justify-end gap-2", full && "mx-auto max-w-3xl px-4 py-2.5 sm:px-6")}>
          {full && <p className="mr-auto min-w-0 truncate text-sm font-semibold">{title}</p>}
          {controls}
        </div>
      </div>
      {/* zoom (not font-size) so every text size inside scales together and lines re-wrap to the width */}
      <div className={cn(full && "mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6")}>
        <div style={{ zoom: size }} data-testid="reading-content">{children}</div>
      </div>
    </div>
  );
}
