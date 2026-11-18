/**
 * Finding key phrases in rendered notes (pure, browser-safe, unit-tested). The rendered text is split across
 * many text nodes (bold, list items), so we search a flattened copy and map matches back to positions.
 */

/** Lower-case, Markdown marks removed, runs of whitespace as one space. */
export const normalise = (s: string) => s.toLowerCase().replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();

/**
 * Flattens text pieces (one per text node) into one searchable string, keeping where each character came from.
 * Whitespace runs collapse to one space, including across pieces.
 */
export function flatten(pieces: string[]) {
  let flat = "";
  const at: { piece: number; offset: number }[] = [];
  pieces.forEach((text, piece) => {
    for (let offset = 0; offset < text.length; offset++) {
      const ch = text[offset];
      if (/\s/.test(ch)) {
        if (flat.length === 0 || flat.endsWith(" ")) continue;
        flat += " ";
      } else {
        flat += ch.toLowerCase();
      }
      at.push({ piece, offset });
    }
  });
  return { flat, at };
}

/** Every occurrence of every phrase, as [start, end) positions in the original pieces. Overlaps are allowed. */
export function findSpans(pieces: string[], phrases: string[]) {
  const { flat, at } = flatten(pieces);
  const spans: { start: { piece: number; offset: number }; end: { piece: number; offset: number } }[] = [];
  for (const phrase of phrases) {
    const needle = normalise(phrase);
    if (needle.length < 3) continue;
    for (let i = flat.indexOf(needle); i !== -1; i = flat.indexOf(needle, i + needle.length)) {
      const last = at[i + needle.length - 1];
      spans.push({ start: at[i], end: { piece: last.piece, offset: last.offset + 1 } });
    }
  }
  return spans;
}
