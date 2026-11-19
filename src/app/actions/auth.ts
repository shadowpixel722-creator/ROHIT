"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensurePersonalSpace } from "@/lib/rooms";
import { firstError, loginSchema, registerSchema } from "@/lib/validation";

let dummy: Promise<string> | null = null;
/** Hash compared against when the email is unknown, so response time doesn't reveal account existence. */
const dummyHash = () => (dummy ??= bcrypt.hash("not-a-real-password", 12));

export type AuthState = { error?: string; fields?: Record<string, string> } | undefined;

export async function registerAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const role = form.get("role") === "TEACHER" ? "TEACHER" : "STUDENT";
  const raw = {
    role,
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    school: String(form.get("school") ?? ""),
    guardianName: String(form.get("guardianName") ?? ""),
    consent: form.get("consent") === "on",
  };
  const fields = { role, name: raw.name, email: raw.email, school: raw.school, guardianName: raw.guardianName };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error), fields };
  const d = parsed.data;

  const exists = await db.user.findUnique({ where: { email: d.email } });
  if (exists) return { error: "An account with this email already exists. Try signing in.", fields };

  const passwordHash = await bcrypt.hash(d.password, 12);
  const user = await db.user.create({
    data: d.role === "TEACHER"
      ? { role: "TEACHER", name: d.name, email: d.email, passwordHash, school: d.school }
      : { role: "STUDENT", name: d.name, email: d.email, passwordHash, guardianName: d.guardianName, consentAt: new Date() },
  });
  await ensurePersonalSpace(user);
  await createSession(user.id);
  redirect("/classes");
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const raw = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error), fields: { email: raw.email } };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  // Same message for unknown email and wrong password, to avoid revealing which accounts exist.
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !valid) return { error: "Incorrect email or password.", fields: { email: raw.email } };

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
