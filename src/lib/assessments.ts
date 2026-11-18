export type AssessmentKind = "TEST" | "ASSIGNMENT" | "EXAM";

export const KIND_LABEL: Record<AssessmentKind, string> = { TEST: "Test", ASSIGNMENT: "Assignment", EXAM: "Exam" };
export const KIND_COLOR: Record<AssessmentKind, string> = { TEST: "#3b93c9", ASSIGNMENT: "#3a9a5b", EXAM: "#d0587a" };
export const kindLabel = (k: string) => KIND_LABEL[k as AssessmentKind] ?? k;
export const kindColor = (k: string) => KIND_COLOR[k as AssessmentKind] ?? "#888";

/** "Today", "Tomorrow", "In 5 days", "3 days ago". */
export function countdown(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** Month grid for a "YYYY-MM" key: weeks of 7 day keys (Monday first), with out-of-month days flagged. */
export function monthGrid(monthKey: string): { key: string; inMonth: boolean }[][] {
  const first = new Date(`${monthKey}-01T00:00:00.000Z`);
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getTime() - lead * 86_400_000);
  const weeks: { key: string; inMonth: boolean }[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start.getTime() + (w * 7 + d) * 86_400_000);
      return { key: day.toISOString().slice(0, 10), inMonth: day.getUTCMonth() === first.getUTCMonth() };
    });
    if (w > 0 && !row.some((c) => c.inMonth)) break;
    weeks.push(row);
  }
  return weeks;
}

export const isMonthKey = (s: string | undefined | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function shiftMonth(monthKey: string, by: number) {
  const d = new Date(`${monthKey}-01T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}
