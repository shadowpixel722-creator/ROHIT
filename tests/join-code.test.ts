import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, formatJoinCode, generateJoinCode, normalizeJoinCode } from "@/lib/join-code";

describe("join codes", () => {
  it("generates 6 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateJoinCode();
      expect(c).toHaveLength(6);
      expect([...c].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
  it("normalises what students type", () => {
    expect(normalizeJoinCode(" abc-def ")).toBe("ABCDEF");
    expect(normalizeJoinCode("ab cd ef")).toBe("ABCDEF");
    expect(normalizeJoinCode("ABCDE")).toBeNull();
    expect(normalizeJoinCode("ABCDE0")).toBeNull();
    expect(formatJoinCode("ABCDEF")).toBe("ABC-DEF");
  });
});
