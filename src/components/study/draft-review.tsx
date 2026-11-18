"use client";

import { Check, Target } from "lucide-react";
import { useState } from "react";
import { approveMcq } from "@/app/actions/mistakes";
import { useRunAction } from "../toast";
import { Badge, Button, cn } from "../ui";

export type DraftMcq = { id: string; chapterName: string; stem: string; choices: string[]; answerIndex: number; explanation: string; tags: (string | null)[] };

/** A student checks one draft question (answer and traps shown) and approves it for everyone's practice. */
export function DraftReview({ q }: { q: DraftMcq }) {
  const runAction = useRunAction();
  const [busy, setBusy] = useState(false);
  return (
    <li className="rounded-xl border border-border p-3" data-testid="student-draft">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge tone="warn">Draft</Badge>
        <span className="truncate text-xs text-muted">{q.chapterName}</span>
        <Button size="sm" className="ml-auto" loading={busy} aria-label={`Approve: ${q.stem}`}
          onClick={async () => {
            if (!confirm("Approve this question for everyone's practice? Check that the ticked answer is right first.")) return;
            setBusy(true);
            await runAction(approveMcq(q.id), "Approved. Thanks for checking!");
            setBusy(false);
          }}><Check className="size-3.5" /> Approve</Button>
      </div>
      <p className="text-sm font-medium">{q.stem}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {q.choices.map((c, i) => (
          <li key={i} className={cn("flex flex-wrap items-center gap-x-2", i === q.answerIndex ? "font-medium text-success" : "text-muted")}>
            <span>{String.fromCharCode(65 + i)}. {c}{i === q.answerIndex && " ✓"}</span>
            {q.tags[i] && <span className="inline-flex items-center gap-1 text-xs text-danger"><Target className="size-3" /> {q.tags[i]}</span>}
          </li>
        ))}
      </ul>
      {q.explanation && <p className="mt-1 text-xs text-muted">{q.explanation}</p>}
    </li>
  );
}
