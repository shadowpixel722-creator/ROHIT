import { describe, expect, it } from "vitest";
import { lessonForText, lessonsForGrade } from "@/lib/knowa/lessons";

const id = (q: string, a = "", grade: string | null = null) => lessonForText(q, a, grade)?.id ?? null;

describe("lessonForText: the 3D lesson that fits a tutor explanation", () => {
  it("finds the lesson a question is clearly about", () => {
    expect(id("Why is the volume of a cone one third of a cylinder?")).toBe("mensuration");
    expect(id("How do I find the hypotenuse?")).toBe("pythag");
    expect(id("What does the mitochondria do in a cell?")).toBe("cell");
    expect(id("How do I convert 13 to binary?")).toBe("binary");
    expect(id("Change this sentence into passive voice")).toBe("voice");
    expect(id("Why do we have seasons on Earth?")).toBe("seasons");
    expect(id("How does a convex lens form an image?")).toBe("lens");
  });

  it("uses the explanation too, but the question counts more", () => {
    expect(id("What is valency?", "Valency is how many electrons an atom gives, takes or shares.")).toBe("atom");
    // The question is about the cell; the answer mentioning a nucleus doesn't pull it to the atom
    expect(id("What is a plant cell made of?", "It has a nucleus, a cell wall and chloroplasts.")).toBe("cell");
  });

  it("offers nothing without a strong match or a clear winner", () => {
    expect(id("What is photosynthesis?", "Plants make food from sunlight, water and carbon dioxide.")).toBeNull();
    expect(id("Who wrote the poem?")).toBeNull();
    expect(id("What is a triangle?")).toBeNull(); // only a weak word
    expect(id("")).toBeNull();
  });

  it("respects the class level the lesson was written for", () => {
    expect(id("Solve this quadratic equation by factorising", "", "8")).toBeNull(); // quadratic lesson is Class 9–10
    expect(id("Solve this quadratic equation by factorising", "", "10")).toBe("quad");
    expect(id("Solve this quadratic equation by factorising", "", null)).toBe("quad");
  });

  it("lessonsForGrade lists every lesson when no level is given", () => {
    expect(lessonsForGrade(null).length).toBeGreaterThanOrEqual(12);
    expect(lessonsForGrade("8").every((l) => l.classes.includes(8))).toBe(true);
  });
});
