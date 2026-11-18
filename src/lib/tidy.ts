/**
 * Presentation clean-up for the combined chapter view (stored text is never changed).
 *  - Lines that are only a page number ("Page 39", "Pg. 12", "p. 4") are dropped.
 *  - Lines that are only a date ("30/10/2026", "2-11-26", "30.10.2026") become a small date marker,
 *    shown once: repeats of the same date on following pages are dropped.
 */
const PAGE_LINE = /^\s*(?:page|pg\.?|p\.)\s*(?:no\.?\s*)?\d{1,4}\s*$/i;
const DATE_LINE = /^\s*(?:date\s*[:\-]?\s*)?(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\s*$/i;

export type TidyState = { lastDate: string | null };

export function tidyPageText(text: string, state: TidyState = { lastDate: null }): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (PAGE_LINE.test(line)) continue;
    const m = DATE_LINE.exec(line);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? `20${y}` : y;
      const key = `${Number(d)}/${Number(mo)}/${year}`;
      if (key !== state.lastDate) out.push(`*${key}*`);
      state.lastDate = key;
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
