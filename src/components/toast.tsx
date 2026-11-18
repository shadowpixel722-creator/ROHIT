"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import type { ActionResult } from "@/lib/types";
import { cn } from "./ui";

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: "success" | "error"; action?: ToastAction };
const Ctx = createContext<{ toast: (message: string, tone?: Toast["tone"], action?: ToastAction) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, tone: Toast["tone"] = "success", action?: ToastAction) => {
    const id = Date.now() + Math.random();
    // Replace an identical message instead of stacking copies (e.g. repeated clicks).
    setToasts((t) => [...t.filter((x) => x.message !== message).slice(-2), { id, message, tone, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 15000 : tone === "error" ? 6000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="print:hidden pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === "error" ? "alert" : "status"}
            className={cn("pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-lg",
              t.tone === "error" ? "border-danger/30" : "border-border")}>
            {t.tone === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button onClick={t.action.onClick} className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-fg hover:bg-primary-hover">{t.action.label}</button>
            )}
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-faint hover:text-text" aria-label="Dismiss"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx.toast;
}

/** Runs an action and toasts its error (and optional success message). Returns whether it succeeded. */
export function useRunAction() {
  const toast = useToast();
  return useCallback(
    async <T,>(p: Promise<ActionResult<T>>, success?: string): Promise<ActionResult<T>> => {
      let res: ActionResult<T>;
      try {
        res = await p;
      } catch (e) {
        if (unstable_isUnrecognizedActionError(e)) {
          // The page was loaded before the app was updated/restarted; its buttons point at old server code.
          toast("The app was updated. Refresh the page to continue (anything you typed may need re-entering).", "error", { label: "Refresh", onClick: () => window.location.reload() });
          return { ok: false, error: "The app was updated. Refresh the page." } as ActionResult<T>;
        }
        res = { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
      }
      if (!res.ok) toast(res.error, "error");
      else if (success) toast(success);
      return res;
    },
    [toast],
  );
}
