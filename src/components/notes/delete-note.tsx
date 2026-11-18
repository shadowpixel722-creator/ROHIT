"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteNote } from "@/app/actions/notes";
import { useRunAction } from "../toast";
import { Button } from "../ui";

export function DeleteNote({ noteId }: { noteId: string }) {
  const runAction = useRunAction();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="ghost" loading={busy} onClick={async () => {
      if (!confirm("Delete this note and its photos for everyone? This can't be undone.")) return;
      setBusy(true);
      const res = await runAction(deleteNote(noteId));
      if (res && !res.ok) setBusy(false);
    }}>{!busy && <Trash2 className="size-4" />} Delete</Button>
  );
}
