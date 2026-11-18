"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Saves `value` `delay` ms after it stops changing,
 * when the page is hidden, and when the component unmounts. `flush()` saves immediately.
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<ActionResult<unknown>>, { delay = 700, validate }: { delay?: number; validate?: (v: T) => string | null } = {}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(value));
  const failed = useRef(false);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const validateRef = useRef(validate);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  latest.current = value;
  saveRef.current = save;
  validateRef.current = validate;

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    const v = latest.current;
    const key = JSON.stringify(v);
    if (key === lastSaved.current && !failed.current) return true;
    const invalid = validateRef.current?.(v);
    if (invalid) {
      failed.current = true;
      setError(invalid);
      setStatus("error");
      return false;
    }
    setStatus("saving");
    const res = await saveRef.current(v);
    if (res.ok) {
      lastSaved.current = key;
      failed.current = false;
      setError(null);
      setStatus("saved");
      return true;
    }
    failed.current = true;
    setError(res.error);
    setStatus("error");
    return false;
  }, []);

  const serialised = JSON.stringify(value);
  useEffect(() => {
    if (serialised === lastSaved.current && !failed.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
    return () => clearTimeout(timer.current);
  }, [serialised, delay, flush]);

  useEffect(() => {
    const pending = () => {
      if (JSON.stringify(latest.current) !== lastSaved.current) void flush();
    };
    window.addEventListener("pagehide", pending);
    return () => {
      window.removeEventListener("pagehide", pending);
      pending();
    };
  }, [flush]);

  return { status, error, flush };
}

export function SaveIndicator({ status, error }: { status: SaveStatus; error?: string | null }) {
  if (status === "saving")
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted" aria-live="polite"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>;
  if (status === "saved")
    return <span className="inline-flex items-center gap-1.5 text-xs text-success" aria-live="polite"><Check className="size-3.5" /> Saved</span>;
  if (status === "error")
    return <span className="inline-flex items-center gap-1.5 text-xs text-danger" role="alert"><CloudOff className="size-3.5" /> {error ?? "Not saved"}</span>;
  return null;
}
