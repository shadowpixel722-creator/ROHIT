"use client";

import { setStudentQuestionCount } from "@/app/actions/mistakes";
import { setAiTutor } from "@/app/actions/tutor";

import { Copy, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { deleteClass, leaveClass, regenerateJoinCode, setJoinOpen, updateClass } from "@/app/actions/classes";
import { GRADES } from "@/lib/constants";
import { formatJoinCode } from "@/lib/join-code";
import { useRunAction, useToast } from "../toast";
import { Button, Field, Input, Select } from "../ui";

export function JoinCodePanel({ classroomId, code, open }: { classroomId: string; code: string; open: boolean }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(formatJoinCode(code));
      toast("Code copied");
    } catch {
      toast("Couldn't copy. Select the code and copy it manually.", "error");
    }
  }
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs text-muted">Join code</p>
        <p className="font-mono text-3xl font-semibold tracking-[0.2em] select-all" data-testid="join-code">{formatJoinCode(code)}</p>
        <p className="mt-1 text-xs text-muted">{open ? "Students can join with this code." : "Joining is closed. The code won't admit new students."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copy}><Copy className="size-3.5" /> Copy</Button>
        <Button variant="secondary" size="sm" loading={busy} onClick={async () => {
          if (!confirm("Make a new code? The old code will stop working. Students already in the class stay.")) return;
          setBusy(true);
          await runAction(regenerateJoinCode(classroomId), "New code created");
          setBusy(false);
        }}>{!busy && <RefreshCw className="size-3.5" />} New code</Button>
        <Button variant="secondary" size="sm" onClick={() => runAction(setJoinOpen(classroomId, !open), open ? "Joining closed" : "Joining opened")}>
          {open ? "Close joining" : "Open joining"}
        </Button>
      </div>
    </div>
  );
}

export function ClassDetailsForm({ classroomId, name, grade, hasIndexedSubjects }: { classroomId: string; name: string; grade: string | null; hasIndexedSubjects?: boolean }) {
  const runAction = useRunAction();
  const toast = useToast();
  const [v, setV] = useState({ name, grade: grade ?? "" });
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      const gradeChanged = (v.grade || null) !== grade;
      if (gradeChanged && hasIndexedSubjects &&
        !confirm(`Switch the chapter lists to the ${v.grade ? `Class ${v.grade}` : "(no class)"} NCERT books?\n\nUnused chapters from the old books are removed. Chapters that already have notes are kept.`)) return;
      setBusy(true);
      const res = await runAction(updateClass(classroomId, { name: v.name, grade: v.grade || null }));
      setBusy(false);
      if (res.ok) {
        const c = res.data?.chapters;
        toast(c && (c.added || c.removed) ? `Class updated. Chapters switched: ${c.added} added, ${c.removed} unused removed${c.kept ? `, ${c.kept} kept because they have notes` : ""}` : "Class updated");
      }
    }}>
      <Field label="Class name" htmlFor="ename"><Input id="ename" value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} required /></Field>
      <Field label="Class" htmlFor="egrade">
        <Select id="egrade" value={v.grade} onChange={(e) => setV({ ...v, grade: e.target.value })}>
          <option value="">Not set</option>
          {GRADES.map((g) => <option key={g} value={g}>Class {g}</option>)}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!v.name.trim() || (v.name === name && v.grade === (grade ?? ""))}>Save</Button>
    </form>
  );
}

export function DeleteClass({ classroomId, name }: { classroomId: string; name: string }) {
  const runAction = useRunAction();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <Button variant="danger" onClick={() => setOpen(true)}>Delete class</Button>;
  return (
    <form className="w-full space-y-3 rounded-xl bg-danger-soft p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const res = await runAction(deleteClass(classroomId, confirmName));
      if (res && !res.ok) setBusy(false);
    }}>
      <Field label={`Type “${name}” to delete this class for everyone`} htmlFor="del-class"><Input id="del-class" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" /></Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { setOpen(false); setConfirmName(""); }}>Cancel</Button>
        <Button type="submit" variant="danger" loading={busy} disabled={confirmName.trim() !== name}>Delete permanently</Button>
      </div>
    </form>
  );
}

export function LeaveClass({ classroomId, name }: { classroomId: string; name: string }) {
  const runAction = useRunAction();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" loading={busy} onClick={async () => {
      if (!confirm(`Leave ${name}? You can rejoin later with the class code.`)) return;
      setBusy(true);
      const res = await runAction(leaveClass(classroomId));
      if (res && !res.ok) setBusy(false);
    }}>{!busy && <LogOut className="size-4" />} Leave class</Button>
  );
}

/** How many multiple-choice questions a student gets when they ask for new ones (0 = off). */
/** Teacher: the AI tutor (Ask a doubt, photo questions, Teach Knowa) on or off for the class. */
export function AiTutorSetting({ classroomId, on }: { classroomId: string; on: boolean }) {
  const runAction = useRunAction();
  const [value, setValue] = useState(on);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={value} aria-label="AI tutor for students"
        onChange={async (e) => {
          const n = e.target.checked; setValue(n);
          const res = await runAction(setAiTutor(classroomId, n), n ? "AI tutor switched on" : "AI tutor switched off");
          if (!res.ok) setValue(!n);
        }} />
      <span><span className="font-medium">AI tutor for students</span> <span className="text-muted">(Ask a doubt, photo questions, Teach Knowa; only students whose consent form you&apos;ve confirmed, answered from the class&apos;s approved notes, nothing saved)</span></span>
    </label>
  );
}

export function StudentQuestionSetting({ classroomId, count }: { classroomId: string; count: number }) {
  const runAction = useRunAction();
  const [value, setValue] = useState(count);
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">Students can make new practice questions</span>
      <select value={value} aria-label="Students can make new practice questions" className="h-8 rounded-lg border border-border bg-surface px-2 text-sm"
        onChange={async (e) => {
          const n = Number(e.target.value);
          const before = value;
          setValue(n);
          const res = await runAction(setStudentQuestionCount(classroomId, n), n ? `Students get ${n} new questions at a time` : "Students can no longer make new questions");
          if (!res.ok) setValue(before);
        }}>
        <option value={0}>Off</option>
        {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} at a time</option>)}
      </select>
    </label>
  );
}
