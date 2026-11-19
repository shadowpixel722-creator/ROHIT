import { describe, expect, it } from "vitest";
import { classSections, classView, viewLabel } from "@/components/classes/class-nav";
import { ALL_POWERS, formatPowers, kindOf, parsePowers, powersFor } from "@/lib/powers";

describe("powers", () => {
  it("gives classroom teachers everything and classroom students nothing", () => {
    expect(powersFor("CLASS", "teacher")).toEqual(ALL_POWERS);
    expect(powersFor("CLASS", "student")).toEqual([]);
    // A teacher-made classroom has no "owner" outside its teachers
    expect(powersFor("CLASS", "owner")).toEqual([]);
  });

  it("lets a student head organise and moderate, but not make study material", () => {
    const head = powersFor("ROOM", "owner");
    expect(head).toEqual(expect.arrayContaining(["syllabus", "members", "moderate", "settings"]));
    expect(head).not.toContain("study");
    expect(powersFor("ROOM", "student")).toEqual([]);
  });

  it("lets a student run every study tool in their own space, with nobody to invite or moderate", () => {
    const own = powersFor("PERSONAL", "owner");
    expect(own).toEqual(expect.arrayContaining(["syllabus", "study", "settings"]));
    expect(own).not.toContain("members");
    expect(own).not.toContain("moderate");
  });

  it("gives a supervisor only what the head ticked", () => {
    expect(powersFor("ROOM", "supervisor", "")).toEqual([]);
    expect(powersFor("ROOM", "supervisor", "moderate")).toEqual(["moderate"]);
    expect(powersFor("ROOM", "supervisor", "members,syllabus")).toEqual(["syllabus", "members"]);
    // Supervisors don't exist outside student rooms
    expect(powersFor("PERSONAL", "supervisor", "moderate")).toEqual([]);
  });

  it("never lets a head hand out settings or study, or anything unknown", () => {
    expect(parsePowers("settings,study,moderate,admin, members ")).toEqual(["members", "moderate"]);
    expect(parsePowers(null)).toEqual([]);
    expect(formatPowers(["moderate", "moderate", "settings"])).toEqual(["moderate"]);
  });

  it("treats unknown kinds as classrooms", () => {
    expect(kindOf("ROOM")).toBe("ROOM");
    expect(kindOf("PERSONAL")).toBe("PERSONAL");
    expect(kindOf("anything")).toBe("CLASS");
  });
});

describe("class views and navigation", () => {
  const slugs = (v: Parameters<typeof classSections>[0]) => classSections(v).flatMap((s) => s.items.map((i) => i.slug));

  it("maps roles to views", () => {
    expect(classView("CLASS", "TEACHER")).toBe("teacher");
    expect(classView("CLASS", "STUDENT")).toBe("student");
    expect(classView("ROOM", "STUDENT")).toBe("member");
    expect(classView("PERSONAL", "STUDENT")).toBe("member");
    expect(classView("ROOM", "SUPERVISOR")).toBe("supervisor");
  });

  it("keeps homework and review to classrooms", () => {
    expect(slugs("teacher")).toEqual(expect.arrayContaining(["review", "homework"]));
    expect(slugs("student")).toContain("homework");
    expect(slugs("member")).not.toContain("homework");
    expect(slugs("member")).toEqual(expect.arrayContaining(["mine", "dashboard", "study", "flashcards"]));
    expect(slugs("supervisor")).not.toContain("mine");
    expect(slugs("supervisor")).not.toContain("review");
  });

  it("labels people by where they are", () => {
    expect(viewLabel("ROOM", "member", true)).toBe("Student head");
    expect(viewLabel("ROOM", "member", false)).toBe("Room member");
    expect(viewLabel("ROOM", "supervisor", false)).toBe("Supervisor");
    expect(viewLabel("PERSONAL", "member", true)).toBe("My space");
    expect(viewLabel("CLASS", "teacher", true)).toBe("Teacher");
  });
});
