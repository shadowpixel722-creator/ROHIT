import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

export const SESSION_COOKIE = "ep_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Other accounts on this browser. Each one chose (Session.quickSwitch) how switching back to it works:
 *  { t: token }  still signed in, so switching back needs no password;
 *  { u: userId } signed out and only remembered by name, so switching back asks for the password.
 */
export const SAVED_COOKIE = "ep_saved";
const MAX_SAVED = 4;

const cookieOptions = (expires: Date) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires });
const farFuture = () => new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

type Jar = Awaited<ReturnType<typeof cookies>>;
type Entry = { t: string } | { u: string };
const userSelect = { id: true, name: true, email: true, role: true } as const;

function readSaved(jar: Jar): Entry[] {
  try {
    const v = JSON.parse(jar.get(SAVED_COOKIE)?.value ?? "[]");
    if (!Array.isArray(v)) return [];
    return v.flatMap((e): Entry[] =>
      typeof e === "string" ? [{ t: e }] // saved before accounts could choose
      : e && typeof e.t === "string" && e.t.length < 100 ? [{ t: e.t }]
      : e && typeof e.u === "string" && e.u.length < 60 ? [{ u: e.u }]
      : []).slice(0, MAX_SAVED * 2);
  } catch {
    return [];
  }
}

function writeSaved(jar: Jar, entries: Entry[]) {
  if (entries.length === 0) jar.delete(SAVED_COOKIE);
  else jar.set(SAVED_COOKIE, JSON.stringify(entries), cookieOptions(farFuture()));
}

type Saved =
  | { kind: "token"; token: string; tokenHash: string; userId: string; user: { id: string; name: string; email: string; role: string } }
  | { kind: "user"; userId: string; user: { id: string; name: string; email: string; role: string } };

/** The saved entries that still work, in order: live sessions and accounts that still exist. */
async function resolve(entries: Entry[]): Promise<Saved[]> {
  const tokens = entries.flatMap((e) => ("t" in e ? [e.t] : []));
  const userIds = entries.flatMap((e) => ("u" in e ? [e.u] : []));
  const [sessions, users] = await Promise.all([
    tokens.length ? db.session.findMany({ where: { tokenHash: { in: tokens.map(hashToken) }, expiresAt: { gt: new Date() } }, select: { tokenHash: true, userId: true, user: { select: userSelect } } }) : [],
    userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: userSelect }) : [],
  ]);
  const byHash = new Map(sessions.map((r) => [r.tokenHash, r]));
  const byId = new Map(users.map((u) => [u.id, u]));
  return entries.flatMap((e): Saved[] => {
    if ("t" in e) { const r = byHash.get(hashToken(e.t)); return r ? [{ kind: "token", token: e.t, ...r }] : []; }
    const u = byId.get(e.u);
    return u ? [{ kind: "user", userId: u.id, user: u }] : [];
  });
}

const toEntry = (s: Saved): Entry => (s.kind === "token" ? { t: s.token } : { u: s.userId });

/** The signed-in account leaves the active slot: kept signed in if it chose quick switching, otherwise signed out and remembered. */
async function stash(token: string | undefined): Promise<Entry[]> {
  if (!token) return [];
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true, quickSwitch: true, expiresAt: true } });
  if (!session || session.expiresAt < new Date()) return [];
  if (session.quickSwitch) return [{ t: token }];
  await db.session.delete({ where: { id: session.id } });
  return [{ u: session.userId }];
}

/** One entry per account (not the active one), at most MAX_SAVED; sessions that are dropped are signed out. */
async function saveList(jar: Jar, activeUserId: string, entries: Entry[]) {
  const seen = new Set([activeUserId]);
  const keep: Saved[] = [];
  const drop: string[] = [];
  for (const s of await resolve(entries)) {
    if (seen.has(s.userId) || keep.length >= MAX_SAVED) { if (s.kind === "token") drop.push(s.tokenHash); }
    else { seen.add(s.userId); keep.push(s); }
  }
  if (drop.length) await db.session.deleteMany({ where: { tokenHash: { in: drop } } });
  writeSaved(jar, keep.map(toEntry));
}

/**
 * Signs this user in. `keepCurrent` ("Add another account"): whoever was signed in stays on this browser's
 * account list. Otherwise the previous session is replaced and the list is cleared, as on a shared computer.
 * `quickSwitch`: when another account takes over later, this one can be switched back to without a password.
 */
export async function createSession(userId: string, { keepCurrent = false, quickSwitch = false } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = farFuture();
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, quickSwitch } });
  const jar = await cookies();
  const current = jar.get(SESSION_COOKIE)?.value;
  if (keepCurrent) await saveList(jar, userId, [...(await stash(current)), ...readSaved(jar)]);
  else {
    if (current) await db.session.deleteMany({ where: { tokenHash: hashToken(current) } });
    jar.delete(SAVED_COOKIE);
  }
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Accounts on this browser besides the signed-in one. `needsPassword`: switching to it asks for its password. */
export async function savedAccounts() {
  const jar = await cookies();
  const me = await getCurrentUser();
  return (await resolve(readSaved(jar))).filter((s) => s.userId !== me?.id)
    .map((s) => ({ ...s.user, role: s.user.role as "TEACHER" | "STUDENT", needsPassword: s.kind === "user" }));
}

/** Whether the signed-in account can be switched back to without a password. */
export async function currentQuickSwitch() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  return (await db.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { quickSwitch: true } }))?.quickSwitch ?? false;
}

export async function setCurrentQuickSwitch(on: boolean) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: hashToken(token) }, data: { quickSwitch: on } });
}

/**
 * Makes a saved account the signed-in one, if it's still signed in (no password needed); the current account
 * moves to the list. Returns the account's email when it needs its password instead, or null if it isn't saved.
 */
export async function switchToSaved(userId: string): Promise<{ ok: true } | { ok: false; email: string | null }> {
  const jar = await cookies();
  const saved = await resolve(readSaved(jar));
  const target = saved.find((s) => s.userId === userId);
  if (!target || target.kind !== "token") return { ok: false, email: target?.user.email ?? null };
  const rest = saved.filter((s) => s !== target).map(toEntry);
  const current = jar.get(SESSION_COOKIE)?.value;
  await saveList(jar, userId, [...(await stash(current)), ...rest]);
  jar.set(SESSION_COOKIE, target.token, cookieOptions(farFuture()));
  return { ok: true };
}

/** Removes one account from this browser's list (signing it out if it was still signed in). */
export async function forgetSaved(userId: string) {
  const jar = await cookies();
  const saved = await resolve(readSaved(jar));
  const gone = saved.flatMap((s) => (s.userId === userId && s.kind === "token" ? [s.tokenHash] : []));
  if (gone.length) await db.session.deleteMany({ where: { tokenHash: { in: gone } } });
  writeSaved(jar, saved.filter((s) => s.userId !== userId).map(toEntry));
}

/**
 * Signs out the current account. If another account on this browser is still signed in, it takes over
 * (returns true). Otherwise nobody is signed in and the list is cleared.
 */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  const saved = await resolve(readSaved(jar));
  const next = saved.find((s) => s.kind === "token");
  if (next && next.kind === "token") {
    jar.set(SESSION_COOKIE, next.token, cookieOptions(farFuture()));
    writeSaved(jar, saved.filter((s) => s !== next).map(toEntry));
    return true;
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(SAVED_COOKIE);
  return false;
}

/** Signs out every account on this browser and forgets them. */
export async function destroyAllSessions() {
  const jar = await cookies();
  const tokens = [jar.get(SESSION_COOKIE)?.value, ...readSaved(jar).flatMap((e) => ("t" in e ? [e.t] : []))].filter((t): t is string => !!t);
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
