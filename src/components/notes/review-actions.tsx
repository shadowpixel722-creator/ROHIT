"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { reviewNote } from "@/app/actions/notes";
import { useRunAction } from "../toast";
import { Button, Input } from "../ui";

/** `room`: a student room, where "approve" shows a hidden note again and "reject" hides it. */
export function ReviewActions({ noteId, status, compact, room = false }: { noteId: string; status: string; compact?: boolean; room?: boolean }) {
  const runAction = useRunAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function act(decision: "approve" | "reject") {
    setBusy(decision);
    const res = await runAction(reviewNote(noteId, decision, reason), room
      ? (decision === "approve" ? "Shown again. The room can see it now" : "Hidden. The author will see your reason")
      : decision === "approve" ? "Approved. The class can see it now" : "Rejected. The student will see your reason");
    setBusy(null);
    if (res.ok) setRejecting(false);
  }
  if (rejecting)
    return (
      <form className="flex w-full flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void act("reject"); }}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={room ? "Reason, e.g. “This is off topic”" : "Reason, e.g. “Page 2 is blurry, please retake it”"} aria-label={room ? "Reason for hiding" : "Reason for rejecting"} autoFocus />
        <div className="flex gap-2">
          <Button type="submit" variant="danger" loading={busy === "reject"} disabled={reason.trim().length < 3}>{room ? "Hide" : "Reject"}</Button>
          <Button variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      </form>
    );
  return (
    <div className="flex gap-2">
      {status !== "APPROVED" && <Button size={compact ? "sm" : "md"} onClick={() => act("approve")} loading={busy === "approve"}><Check className="size-4" /> {room ? "Show again" : "Approve"}</Button>}
      {status !== "REJECTED" && <Button size={compact ? "sm" : "md"} variant="secondary" onClick={() => setRejecting(true)}><X className="size-4" /> {room ? "Hide" : status === "APPROVED" ? "Unpublish" : "Reject"}</Button>}
    </div>
  );
}
