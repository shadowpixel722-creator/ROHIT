/**
 * Last-line privacy filter for AI-read text. The teacher has already checked the page and
 * the model is told to omit personal details; this catches obvious contact details that slip through.
 */
export function redactPersonalDetails(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[removed]")
    // Indian mobile numbers and other phone-like runs: 10–13 digits, optional +, single spaces/dashes between digits.
    .replace(/(?<![\d.])\+?\d(?:[\s-]?\d){9,12}(?!\d)/g, "[removed]");
}

/** Normalises model output: trims, drops code fences, limits size. */
export function cleanTranscript(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  return redactPersonalDetails(t).slice(0, 20_000);
}
