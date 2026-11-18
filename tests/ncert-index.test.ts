import { describe, expect, it } from "vitest";
import { NCERT_INDEX, ncertChapters } from "@/data/ncert-index";

describe("NCERT chapter index", () => {
  it("covers Classes 6–10 core subjects with sources and unique chapters", () => {
    for (const grade of ["6", "7", "8", "9", "10"])
      for (const subject of ["Science", "Mathematics", "Social Science", "English"]) {
        const s = NCERT_INDEX[grade][subject];
        expect(s, `Class ${grade} ${subject}`).toBeDefined();
        expect(s.books.length).toBeGreaterThan(0);
        s.books.forEach((b) => expect(b.code).toMatch(/^[a-j][a-z]{2,3}\d$/));
        expect(s.chapters.length).toBeGreaterThan(4);
        expect(new Set(s.chapters.map((c) => c.toLowerCase())).size).toBe(s.chapters.length);
        s.chapters.forEach((c) => expect(c.length).toBeLessThanOrEqual(160));
      }
  });
  it("covers Classes 3–5 with the new books (Maths Mela, Santoor, Our Wondrous World)", () => {
    for (const grade of ["3", "4", "5"]) {
      for (const subject of ["Mathematics", "English", "The World Around Us"]) {
        const s = NCERT_INDEX[grade][subject];
        expect(s, `Class ${grade} ${subject}`).toBeDefined();
        expect(s.books[0].edition).toBe("Reprint 2026-27");
        expect(new Set(s.chapters).size).toBe(s.chapters.length);
        expect(s.chapters.some((c) => /picture reading|self.assessment/i.test(c))).toBe(false);
      }
    }
    expect(ncertChapters("3", "Mathematics")!.chapters[0]).toBe("1. What's in a Name?");
    expect(ncertChapters("5", "the world around us")!.chapters).toHaveLength(10);
    expect(ncertChapters("4", "Science")).toBeNull(); // Classes 3–5 have "The World Around Us", not Science
  });
  it("matches the Class 8 Science (Curiosity, Reprint 2026-27) contents", () => {
    const s = ncertChapters("8", "science")!;
    expect(s.books[0]).toMatchObject({ code: "hecu1", title: "Curiosity", edition: "Reprint 2026-27" });
    expect(s.chapters).toHaveLength(13);
    expect(s.chapters[4]).toBe("5. Exploring Forces");
  });
  it("returns nothing without a class or for subjects without an index", () => {
    expect(ncertChapters(null, "Science")).toBeNull();
    expect(ncertChapters("8", "Hindi")).toBeNull();
    expect(ncertChapters("12", "Science")).toBeNull();
  });
});
