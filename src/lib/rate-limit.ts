import "server-only";

/** Small in-memory limiter (single server). Used to slow down join-code guessing. */
const hits = new Map<string, number[]>();

export function tooMany(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, recent);
  return recent.length >= limit;
}

export function record(key: string) {
  hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
}
