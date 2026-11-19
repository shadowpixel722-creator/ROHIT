import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

export const SESSION_COOKIE = "ep_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Other accounts signed in on this browser (their session tokens), for switching without signing in again. */
export const SAVED_COOKIE = "ep_saved";
const MAX_SAVED = 4;

const cookieOptions = (expires: Date) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires });
const farFuture = () => new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

type Jar = Awaited<ReturnType<typeof cookies>>;

function readSaved(jar: Jar): string[] {
  try {
    const v = JSON.parse(jar.get(SAVED_COOKIE)?.value ?? "[]");
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && t.length < 100).slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

function writeSaved(jar: Jar, tokens: string[]) {
  if (tokens.length === 0) jar.delete(SAVED_COOKIE);
  else jar.set(SAVED_COOKIE, JSON.stringify(tokens.slice(0, MAX_SAVED)), cookieOptions(farFuture()));
}

/** Live sessions for these tokens, in the same order (expired or signed-out ones are dropped). */
async function liveSessions(tokens: string[]) {
  if (tokens.length === 0) return [];
  const rows = await db.session.findMany({
    where: { tokenHash: { in: tokens.map(hashToken) }, expiresAt: { gt: new Date() } },
    select: { tokenHash: true, userId: true, user: { select: { id: true, name: true, email: true, role: true } } },
  });
  const byHash = new Map(rows.map((r) => [r.tokenHash, r]));
  return tokens.flatMap((token) => { const r = byHash.get(hashToken(token)); return r ? [{ token, ...r }] : []; });
}

/**
 * Signs this user in. `keepCurrent` ("Add another account"): whoever was signed in stays saved on this
 * browser, so they can switch back. Otherwise the previous session is simply replaced, as before.
 */
export async function createSession(userId: string, { keepCurrent = false } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = farFuture();
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  const jar = await cookies();
  const current = jar.get(SESSION_COOKIE)?.value;
  const candidates = keepCurrent && current ? [current, ...readSaved(jar)] : keepCurrent ? readSaved(jar) : [];
  const live = await liveSessions(candidates);
  // One entry per account: an older session of the same account (or one already listed) is signed out.
  const seen = new Set([userId]);
  const keep: string[] = [];
  const drop: string[] = [];
  for (const s of live) {
    if (seen.has(s.userId) || keep.length >= MAX_SAVED) drop.push(s.tokenHash);
    else { seen.add(s.userId); keep.push(s.token); }
  }
  if (drop.length) await db.session.deleteMany({ where: { tokenHash: { in: drop } } });
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  if (keepCurrent) writeSaved(jar, keep);
}

/** Accounts saved on this browser besides the signed-in one. */
export async function savedAccounts() {
  const jar = await cookies();
  const me = await getCurrentUser();
  return (await liveSessions(readSaved(jar))).filter((s) => s.userId !== me?.id).map((s) => ({ ...s.user, role: s.user.role as "TEACHER" | "STUDENT" }));
}

/** Makes a saved account the signed-in one; the current account goes into the saved list. False if it isn't saved (any more). */
export async function switchToSaved(userId: string) {
  const jar = await cookies();
  const saved = await liveSessions(readSaved(jar));
  const target = saved.find((s) => s.userId === userId);
  if (!target) return false;
  const current = jar.get(SESSION_COOKIE)?.value;
  const rest = saved.filter((s) => s !== target).map((s) => s.token);
  jar.set(SESSION_COOKIE, target.token, cookieOptions(farFuture()));
  writeSaved(jar, current ? [current, ...rest] : rest);
  return true;
}

/** Signs out one saved (not current) account on this browser. */
export async function forgetSaved(userId: string) {
  const jar = await cookies();
  const saved = await liveSessions(readSaved(jar));
  const gone = saved.filter((s) => s.userId === userId);
  if (gone.length) await db.session.deleteMany({ where: { tokenHash: { in: gone.map((s) => s.tokenHash) } } });
  writeSaved(jar, saved.filter((s) => s.userId !== userId).map((s) => s.token));
}

/**
 * Signs out the current account. If other accounts are saved here, the next one becomes the signed-in
 * account (returns true); otherwise nobody is signed in.
 */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const [next, ...rest] = await liveSessions(readSaved(jar));
  if (next) {
    jar.set(SESSION_COOKIE, next.token, cookieOptions(farFuture()));
    writeSaved(jar, rest.map((s) => s.token));
    return true;
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(SAVED_COOKIE);
  return false;
}

/** Signs out every account on this browser. */
export async function destroyAllSessions() {
  const jar = await cookies();
  const tokens = [jar.get(SESSION_COOKIE)?.value, ...readSaved(jar)].filter((t): t is string => !!t);
  if (tokens.length) await db.session.deleteMany({ where: { tokenHash: { in: tokens.map(hashToken) } } });
  jar.delete(SESSION_COOKIE);
  jar.delete(SAVED_COOKIE);
}

/** Returns the signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return { ...session.user, role: session.user.role as "TEACHER" | "STUDENT" };
});

/** For pages/layouts: redirects to /login if not signed in. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class AuthError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function requireUserId() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has expired. Please sign in again.");
  return user.id;
}
