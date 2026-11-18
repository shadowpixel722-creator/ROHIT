"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClass } from "@/app/actions/classes";
import { GRADES } from "@/lib/constants";
import { useRunAction } from "../toast";
import { Button, Field, Input, Select } from "../ui";

export function CreateClass() {
  const router = useRouter();
  const runAction = useRunAction();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("8");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await runAction(createClass({ name, grade: grade || null }));
    setBusy(false);
    if (res.ok && res.data) router.push(`/classes/${res.data.id}`);
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
      <Field label="Class name" htmlFor="cname"><Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. 8-B Science" required /></Field>
      <Field label="Class" htmlFor="cgrade">
        <Select id="cgrade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Not set</option>
          {GRADES.map((g) => <option key={g} value={g}>Class {g}</option>)}
        </Select>
      </Field>
      <Button type="submit" loading={busy} disabled={!name.trim()}><Plus className="size-4" /> Create class</Button>
    </form>
  );
}
