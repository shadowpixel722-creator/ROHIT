"use client";

import { KeyRound, LogOut } from "lucide-react";
import { useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { changePassword, deleteAccount, updateName } from "@/app/actions/account";
import { useRunAction } from "../toast";
import { Button, Chevron, Field, Input } from "../ui";

export function NameForm({ name, email }: { name: string; email: string }) {
  const runAction = useRunAction();
  const [v, setV] = useState(name);
  const [busy, setBusy] = useState(false);
  return (
    <form className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      await runAction(updateName(v), "Name updated");
      setBusy(false);
    }}>
      <Field label="Name" htmlFor="acc-name"><Input id="acc-name" value={v} maxLength={80} onChange={(e) => setV(e.target.value)} required /></Field>
      <Field label="Email" htmlFor="acc-email"><Input id="acc-email" value={email} disabled /></Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!v.trim() || v.trim() === name}>Save</Button>
    </form>
  );
}

export function PasswordForm() {
  const runAction = useRunAction();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDetailsElement>(null);
  // A dropdown: closed until you want to change it, and it folds away again once it's changed.
  return (
    <details ref={box} className="rounded-xl border border-border" data-testid="change-password">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-medium select-none">
        <KeyRound className="size-4 text-primary" /> Change password <Chevron className="ml-auto size-4" />
      </summary>
    <form className="grid gap-4 px-3 pb-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const res = await runAction(changePassword(cur, next), "Password changed");
      setBusy(false);
      if (res.ok) { setCur(""); setNext(""); if (box.current) box.current.open = false; }
    }}>
      <Field label="Current password" htmlFor="pw-cur"><Input id="pw-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 8 characters"><Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
      <Button type="submit" variant="secondary" loading={busy} disabled={!cur || next.length < 8} className="sm:mb-5">Change</Button>
    </form>
    </details>
  );
}

export function DangerZone({ email, warning }: { email: string; warning?: string }) {
  const runAction = useRunAction();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Sign out</p>
          <p className="text-xs text-muted">Sign out of this device.</p>
        </div>
        <form action={logoutAction}><Button type="submit" variant="secondary"><LogOut className="size-4" /> Sign out</Button></form>
      </div>
      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-danger">Delete account</p>
            <p className="text-xs text-muted">Permanently deletes your account and your data.</p>
            {warning && <p className="mt-1 text-xs font-medium text-danger">{warning}</p>}
          </div>
          {!open && <Button variant="danger" onClick={() => setOpen(true)}>Delete account</Button>}
        </div>
        {open && (
          <form className="mt-3 space-y-3 rounded-xl bg-danger-soft p-4" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await runAction(deleteAccount(confirmEmail));
            if (res && !res.ok) setBusy(false);
          }}>
            <Field label={`Type ${email} to confirm`} htmlFor="del-email"><Input id="del-email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setOpen(false); setConfirmEmail(""); }}>Cancel</Button>
              <Button type="submit" variant="danger" loading={busy} disabled={confirmEmail.trim().toLowerCase() !== email}>Delete permanently</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
