"use client";

import { CircleHelp, ShieldCheck, ThumbsUp } from "lucide-react";
import { CONFIDENCE_HINT, CONFIDENCE_LABEL, CONFIDENCES, type Confidence } from "@/lib/confidence";
import { cn } from "../ui";

const ICON: Record<Confidence, typeof ShieldCheck> = { SURE: ShieldCheck, UNSURE: ThumbsUp, GUESS: CircleHelp };
const ON: Record<Confidence, string> = {
  SURE: "border-success/60 bg-success-soft text-success",
  UNSURE: "border-primary/60 bg-primary-soft text-primary",
  GUESS: "border-warn/60 bg-warn-soft text-warn",
};

/**
 * "How sure are you?" Sure / Think so / Guessing. Asked before the answer is checked, for multiple choice and
 * written questions. With `onPick` and no `value`, each option is an action button (multiple choice: picking
 * confirms the answer); with `value`, it is a radio group (written quiz).
 */
export function ConfidencePicker({ value, onPick, disabled, name, label = "How sure are you?", compact, error }: {
  value?: Confidence | null; onPick: (c: Confidence) => void; disabled?: boolean; name: string; label?: string; compact?: boolean; error?: boolean;
}) {
  const radio = value !== undefined;
  return (
    <div className="space-y-1.5" data-testid="confidence">
      <p id={`${name}-label`} className={cn("text-xs font-medium", error ? "text-danger" : "text-muted")}>{label}</p>
      <div role={radio ? "radiogroup" : "group"} aria-labelledby={`${name}-label`} className="flex flex-wrap gap-1.5">
        {CONFIDENCES.map((c) => {
          const Icon = ICON[c];
          const on = radio && value === c;
          return (
            <button key={c} type="button" disabled={disabled} onClick={() => onPick(c)}
              {...(radio ? { role: "radio", "aria-checked": on } : {})}
              title={CONFIDENCE_HINT[c]}
              className={cn("inline-flex items-center gap-1.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50",
                compact ? "px-2.5 py-1" : "px-3 py-1.5",
                on ? ON[c] : "border-border bg-surface hover:border-border-strong hover:bg-surface-2")}>
              <Icon className="size-3.5" /> {CONFIDENCE_LABEL[c]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A short line after an answer is checked, when confidence and result disagree. */
export function confidenceNote(correct: boolean, c: Confidence | null): { tone: "danger" | "warn"; text: string } | null {
  if (!c) return null;
  if (!correct && c === "SURE") return { tone: "danger", text: "You were sure, but this was wrong. That's a mistake worth fixing first: it's an idea you believe." };
  if (correct && c === "GUESS") return { tone: "warn", text: "Right, but you were guessing. It's on your Mistake Map as shaky, so review it." };
  return null;
}
