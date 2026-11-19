"use client";

import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinClass } from "@/app/actions/classes";
import { useRunAction, useToast } from "../toast";
import { Button, Field, Input } from "../ui";

export function JoinClass({ asTeacher = false }: { asTeacher?: boolean }) {
  const router = useRouter();
  const runAction = useRunAction();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(joinClass(code));
    setBusy(false);
    if (res.ok && res.data) {
      if (res.data.pending) {
        toast(res.data.room ? `Request sent. The student head of ${res.data.name} needs to approve you.` : `Request sent. The teacher of ${res.data.name} needs to approve you.`);
        setCode("");
        router.refresh();
      } else {
        toast(`You joined ${res.data.name}`);
        router.push(`/classes/${res.data.id}`);
      }
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label={asTeacher ? "Class code" : "Class code or room code"} htmlFor="code" hint={asTeacher ? "Ask the class's teacher or the room's student head for its code. They approve your request before you get access." : "A 6-character code, like ABC-DEF, from your teacher or a room's student head."} className="flex-1">
        <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={9} autoComplete="off" autoCapitalize="characters"
          placeholder="ABC-DEF" className="font-mono tracking-widest uppercase" required />
      </Field>
      <Button type="submit" loading={busy} disabled={code.replace(/[\s-]/g, "").length < 6} className="sm:mb-5"><LogIn className="size-4" /> {asTeacher ? "Request to join" : "Join class or room"}</Button>
    </form>
  );
}
