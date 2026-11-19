"use client";

import { Check, ChevronsUpDown, LogOut, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { forgetAccountAction, logoutAction, signOutAllAction, switchAccountAction } from "@/app/actions/auth";
import { cn } from "./ui";

export type SavedAccount = { id: string; name: string; email: string; role: string };

const roleLabel = (role: string) => (role === "TEACHER" ? "Teacher" : "Student");
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

function Avatar({ name, className }: { name: string; className?: string }) {
  return <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary", className)} aria-hidden>{initial(name)}</span>;
}

/** The sidebar's account button: who's signed in, and a menu to switch, add or sign out accounts on this browser. */
export function AccountMenu({ me, others }: { me: SavedAccount; others: SavedAccount[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" data-testid="account-menu"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
        <Avatar name={me.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{me.name} <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">{roleLabel(me.role)}</span></span>
          <span className="block truncate text-xs text-faint">{me.email}</span>
        </span>
        <ChevronsUpDown className="size-4 text-faint" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label="Accounts" className="absolute inset-x-0 bottom-full z-40 mb-2 rounded-lg border border-border bg-surface p-1 shadow-lg">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Accounts on this device</p>
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <Avatar name={me.name} className="size-7 text-xs" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{me.name}</span>
            <Check className="size-4 text-primary" aria-label="Signed in" />
          </div>
          {others.map((a) => (
            <form key={a.id} action={switchAccountAction.bind(null, a.id)}>
              <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2" aria-label={`Switch to ${a.name}`}>
                <Avatar name={a.name} className="size-7 text-xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{a.name}</span>
                  <span className="block truncate text-xs text-faint">{a.email} · {roleLabel(a.role)}</span>
                </span>
              </button>
            </form>
          ))}
          <div className="my-1 border-t border-border" />
          <Link href="/login?add=1" role="menuitem" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2">
            <UserPlus className="size-4 text-faint" aria-hidden /> Add another account
          </Link>
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-2">
              <LogOut className="size-4 text-faint" aria-hidden /> Sign out{others.length > 0 && ` of ${me.name}`}
            </button>
          </form>
          {others.length > 0 && (
            <form action={signOutAllAction}>
              <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-soft">
                <LogOut className="size-4" aria-hidden /> Sign out of all accounts
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

/** Settings (and phones, which have no sidebar): the accounts saved on this browser. */
export function SavedAccounts({ me, others }: { me: SavedAccount; others: SavedAccount[] }) {
  return (
    <div className="space-y-3" data-testid="saved-accounts">
      <ul className="divide-y divide-border rounded-xl border border-border">
        <li className="flex items-center gap-3 px-3 py-2.5">
          <Avatar name={me.name} />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{me.name}</span><span className="block truncate text-xs text-muted">{me.email} · {roleLabel(me.role)}</span></span>
          <span className="text-xs font-medium text-primary">Signed in</span>
        </li>
        {others.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <Avatar name={a.name} />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.name}</span><span className="block truncate text-xs text-muted">{a.email} · {roleLabel(a.role)}</span></span>
            <form action={switchAccountAction.bind(null, a.id)}>
              <button type="submit" className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2">Switch</button>
            </form>
            <form action={forgetAccountAction.bind(null, a.id)}>
              <button type="submit" className="grid size-7 place-items-center rounded-md text-faint hover:bg-surface-2 hover:text-danger" aria-label={`Sign out ${a.name} on this device`}><X className="size-4" /></button>
            </form>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/login?add=1" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2"><UserPlus className="size-4" /> Add another account</Link>
        {others.length > 0 && (
          <form action={signOutAllAction}>
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft"><LogOut className="size-4" /> Sign out of all accounts</button>
          </form>
        )}
      </div>
      <p className="text-xs text-muted">Switching doesn&apos;t ask for a password, so on a shared computer sign out of every account when you&apos;re done.</p>
    </div>
  );
}
