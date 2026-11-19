"use client";

import { Eye, EyeOff, GraduationCap, School } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import { Alert, Button, Card, cn, Field, Input } from "./ui";

/** `adding`: signing in to another account while `adding.name` stays signed in on this browser. */
export function AuthForm({ mode, adding }: { mode: "login" | "register"; adding?: { name: string } }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<"STUDENT" | "TEACHER">((state?.fields?.role as "STUDENT" | "TEACHER") ?? "STUDENT");
  const isRegister = mode === "register";

  return (
    <Card className="w-full max-w-sm animate-fade-in p-6 sm:p-7">
      <h1 className="text-xl font-semibold tracking-tight">{adding ? (isRegister ? "Create another account" : "Add another account") : isRegister ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted">{isRegister ? "Share notebooks with your class." : "Sign in to your class notebooks."}</p>
      {adding && (
        <p className="mt-3 rounded-xl bg-primary-soft px-3 py-2 text-sm text-primary" data-testid="adding-account">
          You&apos;ll stay signed in as {adding.name} too, and can switch between accounts from the account menu. On a shared computer, sign out of every account when you&apos;re done.
        </p>
      )}

      <form action={action} className="mt-6 space-y-4">
        {adding && <input type="hidden" name="add" value="1" />}
        {state?.error && <Alert>{state.error}</Alert>}
        {isRegister && (
          <div role="radiogroup" aria-label="I am a" className="grid grid-cols-2 gap-2">
            {([["STUDENT", "Student", GraduationCap], ["TEACHER", "Teacher", School]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={role === value} onClick={() => setRole(value)}
                className={cn("flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                  role === value ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:border-border-strong hover:text-text")}>
                <Icon className="size-5" /> {label}
              </button>
            ))}
            <input type="hidden" name="role" value={role} />
          </div>
        )}
        {isRegister && (
          <Field label="Your name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={state?.fields?.name} />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} />
        </Field>
        <Field label="Password" htmlFor="password" hint={isRegister ? "At least 8 characters." : undefined}>
          <div className="relative">
            <Input id="password" name="password" type={show ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={isRegister ? 8 : 1} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-faint hover:text-text" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        {isRegister && role === "TEACHER" && (
          <Field label="School" htmlFor="school" optional>
            <Input id="school" name="school" maxLength={120} defaultValue={state?.fields?.school} />
          </Field>
        )}
        {isRegister && role === "STUDENT" && (
          <div className="space-y-3 rounded-xl bg-surface-2 p-3.5">
            <Field label="Parent or guardian's name" htmlFor="guardianName">
              <Input id="guardianName" name="guardianName" required maxLength={80} defaultValue={state?.fields?.guardianName} />
            </Field>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span className="text-muted">
                My parent or guardian has agreed to me using this app to share school notebooks with my class. Your teacher may also ask for a signed consent form.
              </span>
            </label>
          </div>
        )}
        <Button type="submit" className="w-full" loading={pending}>{isRegister ? "Create account" : "Sign in"}</Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link href={`${isRegister ? "/login" : "/register"}${adding ? "?add=1" : ""}`} className="font-medium text-primary hover:underline">
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
      {adding && <p className="mt-2 text-center text-sm"><Link href="/dashboard" className="text-muted hover:text-text hover:underline">Cancel and go back to {adding.name}</Link></p>}
    </Card>
  );
}
