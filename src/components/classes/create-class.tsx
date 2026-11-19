"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClass, createRoom } from "@/app/actions/classes";
import { GRADES } from "@/lib/constants";
import { useRunAction } from "../toast";
import { Button, Field, Input, Select } from "../ui";

export function CreateClass({ room = false }: { room?: boolean }) {
  const router = useRouter();
  const runAction = useRunAction();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("8");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction((room ? createRoom : createClass)({ name, grade: grade || null }), room ? "Room created. You're its student head" : undefined);
    setBusy(false);
    if (res.ok && res.data) router.push(`/classes/${res.data.id}`);
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <Field label={room ? "Room name" : "Class name"} htmlFor={room ? "rname" : "cname"}><Input id={room ? "rname" : "cname"} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={room ? "e.g. Science study group" : "e.g. 8-B Science"} required /></Field>
      <Field label="Class" htmlFor={room ? "rgrade" : "cgrade"}>
        <Select id={room ? "rgrade" : "cgrade"} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Not set</option>
          {GRADES.map((g) => <option key={g} value={g}>Class {g}</option>)}
        </Select>
      </Field>
      <Button type="submit" loading={busy} disabled={!name.trim()}><Plus className="size-4" /> {room ? "Start room" : "Create class"}</Button>
    </form>
  );
}

export const CreateRoom = () => <CreateClass room />;
