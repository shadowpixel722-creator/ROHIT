import { describe, expect, it } from "vitest";
import { cleanTranscript, redactPersonalDetails } from "@/lib/redact";

describe("redactPersonalDetails", () => {
  it("removes emails and phone numbers but keeps normal numbers", () => {
    expect(redactPersonalDetails("Mail asha.v@school.in today")).toBe("Mail [removed] today");
    expect(redactPersonalDetails("Call 98765 43210 or +91-98765-43210")).toBe("Call [removed] or [removed]");
    expect(redactPersonalDetails("Year 2024, page 12, 3.14159, 1,000 tonnes")).toBe("Year 2024, page 12, 3.14159, 1,000 tonnes");
    expect(redactPersonalDetails("Call 98765 43210.")).toBe("Call [removed].");
    expect(redactPersonalDetails("Ph: 9876543210, ok")).toBe("Ph: [removed], ok");
  });
  it("cleans code fences and trims", () => {
    expect(cleanTranscript("```text\nCoal\n```")).toBe("Coal");
  });
});
