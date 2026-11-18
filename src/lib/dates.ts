/** Date helpers. Calendar dates (exam dates) are stored as UTC midnight. */

export const DEFAULT_TZ = "Asia/Kolkata";

export function isValidTimeZone(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's calendar date (YYYY-MM-DD) in the given time zone. */
export function todayKey(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToKey(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, n: number): string {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToKey(d);
}

/** Whole days from `fromKey` to `toKey` (negative if in the past). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((keyToDate(toKey).getTime() - keyToDate(fromKey).getTime()) / 86_400_000);
}

export function weekdayOf(key: string): number {
  return keyToDate(key).getUTCDay();
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  const date = typeof d === "string" ? keyToDate(d) : d;
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(date);
}

export function relativeDays(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
