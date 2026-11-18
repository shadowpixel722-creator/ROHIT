import { describe, expect, it } from "vitest";
import { classroomSchema, registerSchema, subjectSchema } from "@/lib/validation";

const base = { name: "Asha", email: "A@Example.com", password: "longenough" };

describe("registerSchema", () => {
  it("requires guardian name and consent for students", () => {
    expect(registerSchema.safeParse({ ...base, role: "STUDENT", guardianName: "", consent: true }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, role: "STUDENT", guardianName: "Mrs Verma", consent: false }).success).toBe(false);
    const ok = registerSchema.parse({ ...base, role: "STUDENT", guardianName: "Mrs Verma", consent: true });
    expect(ok.email).toBe("a@example.com");
  });
  it("lets teachers skip the school", () => {
    const t = registerSchema.parse({ ...base, role: "TEACHER", school: "" });
    expect(t.role === "TEACHER" && t.school).toBeNull();
  });
  it("rejects unknown roles", () => {
    expect(registerSchema.safeParse({ ...base, role: "ADMIN" }).success).toBe(false);
  });
});

describe("other schemas", () => {
  it("validates classes and subjects without injecting defaults into partial updates", () => {
    expect(classroomSchema.parse({ name: " 8-B ", grade: "8" })).toEqual({ name: "8-B", grade: "8" });
    expect(classroomSchema.safeParse({ name: "8-B", grade: "13" }).success).toBe(false);
    expect(subjectSchema.partial().parse({ color: "rose" })).toEqual({ color: "rose" });
  });
});
