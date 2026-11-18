import { describe, expect, it } from "vitest";
import { tidyPageText } from "@/lib/tidy";

describe("tidyPageText", () => {
  it("drops page-number lines and keeps content", () => {
    expect(tidyPageText("Page 39\n\n10. Analyse Fig. 8.24\npg. 4\nP. 12")).toBe("10. Analyse Fig. 8.24");
  });
  it("turns date lines into one marker and drops repeats across pages", () => {
    const state = { lastDate: null };
    expect(tidyPageText("30/10/2026\n\n## Nature of matter", state)).toBe("*30/10/2026*\n\n## Nature of matter");
    expect(tidyPageText("30-10-26\nMore notes", state)).toBe("More notes");
    expect(tidyPageText("2/11/2026\nNext lesson", state)).toBe("*2/11/2026*\nNext lesson");
  });
  it("leaves dates inside sentences alone", () => {
    expect(tidyPageText("Test on 30/10/2026 at school")).toBe("Test on 30/10/2026 at school");
  });
});
