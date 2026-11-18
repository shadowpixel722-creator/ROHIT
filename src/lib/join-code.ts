/** No 0/O, 1/I/L — easy to read aloud and type from a board. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** Uses Web Crypto (cryptographically secure, works in Node and browsers). Rejection sampling avoids bias. */
export function generateJoinCode(): string {
  const out: string[] = [];
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join("");
}

/** Accepts "abc-def", " ABC DEF " etc. Returns null if it can't be a valid code. */
export function normalizeJoinCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export const formatJoinCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
