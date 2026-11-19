"use client";

import { CircleHelp, X } from "lucide-react";
import { useState } from "react";
import { explainThis, type UnderstandResult, type UnderstandTarget } from "@/app/actions/understand";
import { ReadAloud } from "./speech";
import { Alert, cn } from "./ui";

/**
 * "I don't understand" under a question, an explanation, a 3D model or a lesson step. Opens a simpler
 * explanation: by AI for students who may use it (it never gives away an unanswered question's answer),
 * otherwise what's already saved. Give it a `key` that changes with the item, so it resets.
 */
export function HelpMeUnderstand({ target, label = "I don't understand", className }: { target: UnderstandTarget; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UnderstandResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    const res = await explainThis(target).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check your connection." }));
    setBusy(false);
    if (res.ok) setResult(res.data!); else setError(res.error);
  };

  if (!result) {
    return (
      <div className={cn("space-y-2", className)}>
        <button type="button" onClick={open} disabled={busy} data-testid="understand"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:border-primary/40 hover:text-text disabled:opacity-60">
          <CircleHelp className="size-3.5" aria-hidden /> {busy ? "Finding a simpler way…" : label}
        </button>
        {error && <Alert tone="warn">{error}</Alert>}
      </div>
    );
  }

  const spoken = result.source === "ai" ? result.explanation : `${result.heading}. ${result.text}`;
  return (
    <div className={cn("relative rounded-xl border border-primary/25 bg-primary-soft/50 p-3.5 text-sm", className)} data-testid="understand-panel" aria-live="polite">
      <button type="button" onClick={() => setResult(null)} aria-label="Close the explanation" className="absolute top-2 right-2 rounded p-1 text-muted hover:bg-surface-2 hover:text-text"><X className="size-4" /></button>
      {result.source === "ai" ? (
        <>
          <p className="pr-6 text-xs font-semibold uppercase tracking-wider text-primary">In simpler words</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed" data-testid="understand-text">{result.explanation}</p>
          {result.words.length > 0 && (
            <dl className="mt-2 space-y-0.5 text-sm">
              {result.words.map((w) => <div key={w.word}><dt className="inline font-semibold">{w.word}:</dt> <dd className="inline text-muted">{w.meaning}</dd></div>)}
            </dl>
          )}
          <p className="mt-2 text-xs text-faint">Explained by AI. It can make mistakes.</p>
        </>
      ) : (
        <>
          {result.why && <p className="pr-6 text-xs text-muted" data-testid="understand-why">{result.why}</p>}
          <p className={cn("pr-6 text-xs font-semibold uppercase tracking-wider text-primary", result.why && "mt-2")}>{result.heading}</p>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed" data-testid="understand-text">{result.text}</p>
        </>
      )}
      <ReadAloud text={spoken} className="mt-1 px-0" />
    </div>
  );
}
