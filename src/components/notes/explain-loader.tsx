"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { explainNote } from "@/app/actions/explain";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useRunAction } from "../toast";
import { Alert, Button } from "../ui";

// Lessons on one page are explained one at a time, so opening a chapter never fires a burst of AI calls.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>) => { const p = queue.then(job, job); queue = p.catch(() => {}); return p; };

/** Shown where a lesson's explanation isn't ready: asks for it once, then refreshes the page to show it. */
export function ExplainLoader({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    enqueue(async () => {
      try {
        const res = await explainNote(noteId);
        if (!alive) return;
        if (res.ok) router.refresh();
        else setError(res.error);
      } catch (e) {
        if (alive) setError(unstable_isUnrecognizedActionError(e) ? "The app was updated. Refresh the page." : "Couldn't reach the server. Check your connection.");
      }
    });
    return () => { alive = false; };
  }, [noteId, attempt, router]);
  if (error) {
    return (
      <div className="space-y-2" data-testid="explain-error">
        <Alert tone="warn">{error}</Alert>
        <Button size="sm" variant="secondary" onClick={() => { setError(null); setAttempt((n) => n + 1); }}><RefreshCw className="size-3.5" /> Try again</Button>
      </div>
    );
  }
  return <p className="flex items-center gap-2 text-sm text-muted" data-testid="explain-loading"><Loader2 className="size-4 animate-spin" /> Writing an explanation of this lesson… (about 10 seconds)</p>;
}

/** Teacher: make a fresh explanation (e.g. after fixing the notes' text by hand). */
export function RemakeExplanation({ noteId }: { noteId: string }) {
  const runAction = useRunAction();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="ghost" loading={busy} onClick={async () => {
      setBusy(true);
      const res = await runAction(explainNote(noteId, true), "New explanation made");
      setBusy(false);
      if (res.ok) router.refresh();
    }}>{!busy && <RefreshCw className="size-3.5" />} Remake</Button>
  );
}
