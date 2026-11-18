/** Pure helpers for the dashboard (no database), so they're easy to unit-test. */

export type ChapterProgress = { id: string; name: string; ready: boolean; percent: number | null };

export type SubjectSummary = {
  ready: number;      // chapters with approved study material
  practised: number;  // of those, chapters the student has taken at least one quiz on
  average: number | null; // average mastery over practised chapters
  weakest: { id: string; name: string; percent: number | null } | null; // what to practise next
};

/**
 * One subject's progress for one student. "Next to practise" is a ready chapter with no quiz yet,
 * otherwise the practised chapter with the lowest mastery below 80%.
 */
export function summariseSubject(chapters: ChapterProgress[]): SubjectSummary {
  const ready = chapters.filter((c) => c.ready);
  const practised = ready.filter((c) => c.percent !== null);
  const average = practised.length ? Math.round(practised.reduce((s, c) => s + (c.percent ?? 0), 0) / practised.length) : null;
  const untried = ready.find((c) => c.percent === null);
  const lowest = [...practised].sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0];
  const weakest = untried ?? (lowest && (lowest.percent ?? 0) < 80 ? lowest : null);
  return { ready: ready.length, practised: practised.length, average, weakest: weakest ? { id: weakest.id, name: weakest.name, percent: weakest.percent } : null };
}

/** Totals across subjects. */
export function overall(subjects: SubjectSummary[]) {
  const ready = subjects.reduce((s, x) => s + x.ready, 0);
  const practised = subjects.reduce((s, x) => s + x.practised, 0);
  const withAvg = subjects.filter((x) => x.average !== null);
  // Weighted by chapters practised, so a subject with one quiz doesn't count as much as one with ten.
  const average = practised ? Math.round(withAvg.reduce((s, x) => s + (x.average ?? 0) * x.practised, 0) / practised) : null;
  return { ready, practised, average };
}

/** Class-wide figures are shown to teachers only when enough students are in them that nobody can be singled out. */
export const MIN_GROUP = 3;
export const groupAverage = (scores: number[]) => (scores.length >= MIN_GROUP ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : null);

/** Monday of the week that `key` (YYYY-MM-DD) falls in. */
export function weekStart(key: string) {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** The last `weeks` week-start keys, oldest first, ending with this week. */
export function recentWeeks(todayKey: string, weeks: number) {
  const thisWeek = new Date(`${weekStart(todayKey)}T00:00:00.000Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(thisWeek);
    d.setUTCDate(d.getUTCDate() - (weeks - 1 - i) * 7);
    return d.toISOString().slice(0, 10);
  });
}

/** Groups dated items into those weeks (items outside them are ignored). */
export function byWeek<T>(items: { day: string; item: T }[], weeks: string[]) {
  const out = new Map<string, T[]>(weeks.map((w) => [w, []]));
  for (const { day, item } of items) out.get(weekStart(day))?.push(item);
  return out;
}
