import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
async function go(page: Page, url: string) { await page.goto(url); await page.waitForLoadState("networkidle"); }
async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await go(page, "/register");
  await page.getByRole("radio", { name: role }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(`${role.toLowerCase()}-${uid()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
  if (role === "Student") { await page.getByLabel("Parent or guardian's name").fill("Guardian"); await page.getByRole("checkbox").check(); }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.waitForLoadState("networkidle");
  return page;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("homework: AI-written sheet, edited and published; handed in; AI-suggested marks confirmed by the teacher; insights", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Iyer");
  await t.getByLabel("Class name").fill("8-H");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();

  const asha = await person(browser, "Student", "Asha");
  const ravi = await person(browser, "Student", "Ravi");
  for (const s of [asha, ravi]) {
    await s.getByLabel("Class code").fill(code);
    await s.getByRole("button", { name: "Join class" }).click();
    await expect(s.getByText(/You joined/)).toBeVisible();
  }
  await go(t, classUrl);
  for (const n of ["Asha", "Ravi"]) {
    await t.getByTestId("roster-row").filter({ hasText: n }).getByRole("button", { name: "Confirm form received" }).click();
    await expect(t.getByTestId("roster-row").filter({ hasText: n })).not.toContainText("Confirm form received");
  }

  // The teacher makes a sheet: a draft students can't see
  await go(t, `${classUrl}/homework`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Questions").selectOption("5");
  await t.getByLabel("Instructions for students").fill("Write in full sentences.");
  await t.getByTestId("make-sheet-go").click();
  await expect(t.getByTestId("sheet-editor")).toBeVisible({ timeout: 20_000 });
  await expect(t.getByTestId("sheet-question")).toHaveCount(5);
  await go(asha, `${classUrl}/homework`);
  await expect(asha.getByTestId("homework-row")).toHaveCount(0);

  // Edit: remove a question, change a mark, then publish
  await t.getByRole("button", { name: "Remove question 5" }).click();
  await t.getByLabel("Marks for question 1").selectOption("2");
  await t.getByTestId("publish-sheet").click();
  await expect(t.getByText("Published to the class")).toBeVisible();
  await expect(t.getByTestId("sheet-editor")).toContainText("4 questions · 8 marks");
  const sheetUrl = t.url();

  // Asha answers in the app (the answer key never reaches her) and hands in
  await go(asha, `${classUrl}/homework`);
  await asha.getByTestId("homework-row").first().click();
  const sheet = asha.getByTestId("answer-sheet");
  await expect(sheet).toContainText("Write in full sentences.");
  await expect(sheet).not.toContainText("A model answer for question");
  for (let i = 1; i <= 4; i++) await sheet.getByLabel(`Answer ${i}`).fill(i < 4 ? `A proper answer to question ${i} in a sentence.` : "idk");
  await asha.getByTestId("hand-in").click();
  await expect(asha.getByText("Handed in. Your teacher will mark it.")).toBeVisible();

  // The teacher marks: AI suggests, the student can't see it yet
  await go(t, sheetUrl);
  const aRow = t.getByTestId("mark-row").filter({ hasText: "Asha" });
  await expect(aRow).toContainText("Handed in");
  await aRow.getByTestId("mark-typed").click();
  await expect(t.getByText("Marks suggested. Check them, then confirm.")).toBeVisible();
  await expect(aRow).toContainText("Suggested");
  await go(asha, `${classUrl}/homework`);
  await expect(asha.getByTestId("homework-row").first()).toContainText("Handed in");
  // ...the teacher adjusts one mark and confirms
  await go(t, sheetUrl);
  const review = t.getByTestId("mark-row").filter({ hasText: "Asha" }).getByTestId("mark-review");
  await review.getByLabel("Marks for question 4").fill("1");
  await review.getByTestId("confirm-marks").click();
  await expect(t.getByText("Marks confirmed. The student can see them now.")).toBeVisible();

  // Ravi handed in on paper: marked from a photo
  const rRow = t.getByTestId("mark-row").filter({ hasText: "Ravi" });
  await expect(rRow).toContainText("Not handed in");
  await rRow.getByTestId("mark-photo").setInputFiles({ name: "paper.png", mimeType: "image/png", buffer: PNG });
  await expect(rRow).toContainText("Suggested", { timeout: 20_000 });
  await rRow.getByTestId("confirm-marks").click();
  await expect(rRow).toContainText("confirmed");

  // Asha sees her marks and the teacher's comments
  await go(asha, `${classUrl}/homework`);
  const total = (await asha.getByTestId("homework-row").first().textContent())!;
  expect(total).toMatch(/\d+(\.5)? \/ 8/);
  await asha.getByTestId("homework-row").first().click();
  await expect(asha.getByTestId("homework-feedback")).toContainText("Marked by your teacher");
  await expect(asha.getByLabel("Answer 1")).toBeDisabled();

  // Insights: averages and a parent note link
  await go(t, `${classUrl}/homework`);
  const insights = t.getByTestId("homework-insights");
  await expect(insights).toContainText("Asha");
  await expect(insights.getByRole("link", { name: "Parent note" }).first()).toHaveAttribute("href", /mail\.google\.com/);
  if (process.env.SHOTS_DIR) await t.screenshot({ path: `${process.env.SHOTS_DIR}/homework.png`, fullPage: true });
});
