import { expect, test, type Browser, type Page } from "@playwright/test";

const PDF = Buffer.from("%PDF-1.4\n% School circular\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
const TXT = Buffer.from("Syllabus: chapters 1 to 5\n", "utf8");
const FAKE = Buffer.from("MZ\x90\x00 not really a pdf", "latin1");
const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: role }).click();
  await expect(page.getByRole("radio", { name: role })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`${role.toLowerCase()}-${uid()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
  if (role === "Student") {
    await page.getByLabel("Parent or guardian's name").fill("Guardian");
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.waitForLoadState("networkidle");
  return page;
}

test("Exam patterns: teacher picks lessons that have notes and sets sections; the class can see the pattern", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Rao");
  await t.getByLabel("Class name").fill("8-P");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill("Coal lesson");
  await t.getByLabel("Typed notes").fill("Coal is a fossil fuel formed from ancient plants over millions of years.");
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();

  const s = await person(browser, "Student", "Ravi");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();
  await go(s, `${classUrl}/exam-patterns`);
  await expect(s.getByText("No exam patterns yet")).toBeVisible();

  // Teacher: only lessons with notes are offered; a pattern needs at least one lesson
  await go(t, `${classUrl}/exam-patterns`);
  const editor = t.getByTestId("new-pattern").getByTestId("pattern-editor");
  const picker = editor.getByTestId("lesson-picker");
  await expect(picker.getByRole("checkbox")).toHaveCount(1);
  await expect(picker).toContainText("Exploring Forces");
  await expect(picker).toContainText("1 note");
  // The paste box grows with a long pattern (and can be dragged bigger)
  const paste = editor.getByTestId("pasted-pattern");
  const h0 = (await paste.boundingBox())!.height;
  await paste.fill(Array.from({ length: 12 }, (_, i) => `Section ${String.fromCharCode(65 + i)}: 2 questions of 3 marks each`).join("\n"));
  const h1 = (await paste.boundingBox())!.height;
  expect(h1).toBeGreaterThan(h0 + 100);
  expect(await paste.evaluate((el) => getComputedStyle(el).resize)).toBe("vertical");
  await paste.fill("");
  await editor.getByRole("button", { name: "Unit test (40 marks)" }).click();
  await expect(editor.getByTestId("pattern-total")).toHaveText("21 questions · 40 marks · 90 min");
  await expect(editor.getByRole("button", { name: "Save pattern" })).toBeDisabled();
  await picker.getByLabel(/Exploring Forces/).check();
  await expect(picker).toContainText("(1 chosen)");
  // Attach the school's circular before saving: it uploads once the pattern is saved
  await editor.getByLabel("Choose files to attach to the pattern").setInputFiles([{ name: "Circular.pdf", mimeType: "application/pdf", buffer: PDF }]);
  await expect(editor.getByTestId("pattern-file-list")).toContainText("Circular.pdf");
  await editor.getByRole("button", { name: "Save pattern" }).click();
  await expect(t.getByText("Pattern added")).toBeVisible();
  await expect(t.getByText("1 file attached")).toBeVisible();
  await expect(t.getByTestId("saved-pattern")).toContainText("1 lesson · 21 questions · 40 marks · 90 min · 1 file");
  await expect(editor.getByTestId("pattern-files")).toContainText("0/5");

  // On the saved pattern, files upload straight away; a program renamed to .pdf is refused
  await t.getByTestId("saved-pattern").locator("summary").click();
  const saved = t.getByTestId("saved-pattern").getByTestId("pattern-files");
  await saved.getByLabel("Choose files to attach to the pattern").setInputFiles([{ name: "virus.pdf", mimeType: "application/pdf", buffer: FAKE }]);
  await expect(t.getByText(/“virus.pdf” isn't really a PDF file/)).toBeVisible();
  await saved.getByLabel("Choose files to attach to the pattern").setInputFiles([{ name: "syllabus.txt", mimeType: "text/plain", buffer: TXT }]);
  await expect(t.getByText("1 file attached")).toBeVisible();
  await expect(saved.getByTestId("pattern-file-list").locator("li")).toHaveCount(2);
  t.once("dialog", (d) => d.accept());
  await saved.getByRole("button", { name: "Remove syllabus.txt" }).click();
  await expect(t.getByText("File removed")).toBeVisible();
  await expect(saved.getByTestId("pattern-file-list").locator("li")).toHaveCount(1);

  // The pattern sheet: lessons (linked to the notebook) and the sections table
  await t.getByRole("link", { name: "View pattern" }).click();
  await expect(t.getByTestId("pattern-sheet-marks")).toHaveText("Maximum marks: 40");
  await expect(t.getByTestId("pattern-lesson")).toHaveText(["5. Exploring Forces"]);
  await expect(t.getByTestId("pattern-row")).toHaveCount(4);
  const patternUrl = t.url();

  // The student sees the pattern and its lessons
  await go(s, `${classUrl}/exam-patterns`);
  await s.getByTestId("pattern-list").getByRole("link", { name: /Unit test/ }).click();
  await expect(s.getByTestId("pattern-lesson")).toHaveText(["5. Exploring Forces"]);
  await expect(s.getByTestId("pattern-sheet")).toContainText("Multiple choice");
  // ...and can download the attachment (always as a download)
  const fileLink = s.getByTestId("pattern-attachments").getByRole("link", { name: /Circular.pdf/ });
  const fileUrl = (await fileLink.getAttribute("href"))!;
  const res = await s.request.get(fileUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("attachment");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  // The portion links to each lesson's explanation and its notes
  const lesson = s.getByTestId("portion-lesson").filter({ hasText: "Exploring Forces" });
  await lesson.getByRole("link", { name: "Notes" }).click();
  await expect(s).toHaveURL(/\/notebook\?subject=.+&chapter=.+/);
  await expect(s.getByText("Coal lesson")).toBeVisible();
  await s.goBack();
  await s.getByTestId("portion-lesson").filter({ hasText: "Exploring Forces" }).getByRole("link", { name: "Explanation" }).click();
  await expect(s).toHaveURL(/\/explain\/[^/]+$/);
  await expect(s.getByRole("heading", { name: "5. Exploring Forces" })).toBeVisible();

  // Calendar → pattern: the teacher links a test to the pattern; choosing it ticks the pattern's lessons
  await go(t, `${classUrl}/calendar`);
  const form = t.getByTestId("assessment-form");
  await form.getByLabel("Title").fill("Unit 1 test");
  await form.getByLabel("Date", { exact: true }).fill(plusDays(5));
  await form.getByLabel("Exam pattern").selectOption({ label: "Unit test (40 marks)" });
  await expect(form.getByLabel("5. Exploring Forces")).toBeChecked();
  await form.getByRole("button", { name: "Add to calendar" }).click();
  await expect(t.getByText("Test added to the calendar")).toBeVisible();
  await go(s, `${classUrl}/calendar`);
  const row = s.getByTestId("assessment-row").filter({ hasText: "Unit 1 test" });
  await row.getByTestId("assessment-pattern").click();
  await expect(s).toHaveURL(patternUrl);
  // ...and the pattern page lists that date, linking back to the calendar
  await expect(s.getByTestId("pattern-dates")).toContainText("Unit 1 test");
  await expect(s.getByTestId("pattern-dates")).toContainText("In 5 days");
  await s.getByTestId("pattern-dates").getByRole("link", { name: "Unit 1 test" }).click();
  await expect(s).toHaveURL(/\/calendar\?m=\d{4}-\d{2}#a-/);

  // Sample papers are gone; outsiders get 404
  expect((await s.goto(`${classUrl}/papers`))?.status()).toBe(404);
  const o = await person(browser, "Teacher", "Mr Out");
  expect((await o.goto(patternUrl))?.status()).toBe(404);
  expect((await o.request.get(fileUrl)).status()).toBe(404);
  expect((await o.goto(`${classUrl}/exam-patterns`))?.status()).toBe(404);
});
