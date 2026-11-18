import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function go(page: Page, url: string) { await page.goto(url); await page.waitForLoadState("networkidle"); }
async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
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

test("study plan checklist for a test, the on-device file vault, and read aloud", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Iyer");
  await t.getByLabel("Class name").fill("8-P");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill("Forces notes");
  await t.getByLabel("Typed notes").fill("A force is a push or a pull. Friction slows things down.");
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();
  // A test in 10 days covering three chapters
  await go(t, `${classUrl}/calendar`);
  await t.getByLabel("Title").fill("Unit 3 test");
  await t.getByLabel("Date", { exact: true }).fill(plusDays(10));
  for (const c of ["4. Electricity: Magnetic and Heating Effects", "5. Exploring Forces", "6. Pressure, Winds, Storms, and Cyclones"]) await t.getByLabel(c).check();
  await t.getByRole("button", { name: "Add to calendar" }).click();
  await expect(t.getByText("Test added to the calendar")).toBeVisible();
  await expect(t.getByTestId("study-plan")).toHaveCount(0); // students only

  const s = await person(browser, "Student", "Ravi");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();

  // The student's plan: one chapter a day from today, then revision before the test
  await go(s, `${classUrl}/calendar`);
  const plan = s.getByTestId("study-plan");
  await expect(plan).toContainText("Unit 3 test");
  await expect(plan).toContainText("0 of 5 tasks done");
  const today = plan.getByTestId("plan-today").getByTestId("plan-task");
  await expect(today).toHaveCount(1);
  await expect(today).toContainText("4. Electricity: Magnetic and Heating Effects");
  await expect(today.getByRole("link", { name: "Practise" })).toHaveAttribute("href", /\/study\//);
  await today.getByRole("checkbox").check();
  await expect(plan).toContainText("1 of 5 tasks done");
  await s.reload();
  await expect(s.getByTestId("study-plan")).toContainText("1 of 5 tasks done");
  await expect(s.getByTestId("study-plan").getByTestId("plan-today").getByRole("checkbox")).toBeChecked();
  if (process.env.SHOTS_DIR) await s.getByTestId("study-plan").screenshot({ path: `${process.env.SHOTS_DIR}/plan.png` });

  // Read aloud on the notes
  await go(s, `${classUrl}/notebook`);
  await s.getByTestId("note-card").first().click();
  await expect(s.getByTestId("read-aloud")).toBeVisible();

  // My files: a note and a file, kept on this device (still there after a reload), and deleted
  await go(s, "/files");
  await s.getByLabel("Note title").fill("Formulas to remember");
  await s.getByLabel("Note text").fill("Pressure = force / area");
  await s.getByTestId("vault-save-note").click();
  await expect(s.getByTestId("vault-msg")).toHaveText("Note saved.");
  await s.getByTestId("vault-file").setInputFiles({ name: "slides.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await expect(s.getByTestId("vault-item")).toHaveCount(2);
  await s.reload();
  await expect(s.getByTestId("vault-item")).toHaveCount(2);
  await expect(s.getByTestId("vault-list")).toContainText("Pressure = force / area");
  await s.getByTestId("vault-item").filter({ hasText: "slides.pdf" }).getByRole("button", { name: "Delete" }).click();
  await expect(s.getByTestId("vault-item")).toHaveCount(1);
  // Another person on another device doesn't see them
  await go(t, "/files");
  await expect(t.getByTestId("vault-item")).toHaveCount(0);
});
