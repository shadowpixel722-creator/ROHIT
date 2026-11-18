"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { addComment, deleteComment } from "@/app/actions/notes";
import { useRunAction } from "../toast";
import { Badge, Button, Textarea } from "../ui";

export type ClientComment = { id: string; body: string; authorName: string; authorIsTeacher: boolean; mine: boolean; createdAt: string };

const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function Comments({ noteId, comments, canModerate }: { noteId: string; comments: ClientComment[]; canModerate: boolean }) {
  const runAction = useRunAction();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(addComment(noteId, body));
    setBusy(false);
    if (res.ok) setBody("");
  }
  return (
    <div className="space-y-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet. Ask a question or add something you noticed.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-surface-2/60 px-3.5 py-2.5" data-testid="comment">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-text">{c.authorName}</span>
                {c.authorIsTeacher && <Badge tone="primary">Teacher</Badge>}
                <span className="text-faint">{when(c.createdAt)}</span>
                {(c.mine || canModerate) && (
                  <button onClick={() => confirm("Delete this comment?") && runAction(deleteComment(c.id))} className="ml-auto text-faint hover:text-danger" aria-label="Delete comment"><Trash2 className="size-3.5" /></button>
                )}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Write a comment…" className="min-h-20" aria-label="Write a comment" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-faint">Be kind. Your teacher can see and remove comments.</span>
          <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>Comment</Button>
        </div>
      </form>
    </div>
  );
}
