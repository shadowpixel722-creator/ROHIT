import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
// A tiny valid PNG (1×1), to stand in for a photo of a question
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("the guarded AI tutor: consent first, answers from class notes, photo questions, Teach Knowa, teacher switch", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Iyer");
  await t.getByLabel("Class name").fill("8-A");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill("Friction");
  await t.getByLabel("Typed notes").fill("Friction is a force that slows moving things down. Rough surfaces have more friction than smooth ones.");
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();

  const s = await person(browser, "Student", "Asha");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();

  // Before the teacher confirms the consent form, the tutor is closed
  await go(s, `${classUrl}/ask`);
  await expect(s.getByTestId("tutor")).toContainText("consent form");
  await expect(s.getByTestId("tutor-send")).toHaveCount(0);

  await go(t, classUrl);
  await t.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Confirm form received" }).click();
  await expect(t.getByText("Consent confirmed")).toBeVisible();

  // Ask a doubt: answered from the class notes, which are named
  await go(s, `${classUrl}/ask`);
  await s.getByLabel("Your doubt").fill("Why does a ball stop rolling? Friction?");
  await s.getByTestId("tutor-send").click();
  const answer = s.getByTestId("tutor-answer").last();
  await expect(answer).toContainText("From your notes: Friction is a force that slows moving things down.");
  await expect(answer).toContainText("From your notes: Friction");
  await expect(answer.getByTestId("read-aloud")).toBeVisible();
  // A follow-up chip, and a photo question
  await s.getByRole("button", { name: "Explain simpler" }).click();
  await expect(s.getByTestId("tutor-answer")).toHaveCount(2);
  await s.getByTestId("tutor-photo").setInputFiles({ name: "q.png", mimeType: "image/png", buffer: PNG });
  await expect(s.getByText("Photo ready")).toBeVisible();
  await s.getByTestId("tutor-send").click();
  await expect(s.getByTestId("tutor-answer").last()).toContainText("I can see your picture.");
  await expect(s.getByTestId("tutor-you").last().locator("img")).toBeVisible();
  // Nothing is saved: a reload starts empty
  await s.reload();
  await expect(s.getByTestId("tutor-answer")).toHaveCount(0);

  // Teach Knowa
  await s.getByRole("button", { name: "Teach Knowa" }).click();
  await s.getByLabel("Topic").fill("Friction");
  await s.getByLabel("Your explanation").fill("Friction is the force between two surfaces that rub together, and it slows things down, like brakes on a bicycle.");
  await s.getByTestId("teach-send").click();
  const fb = s.getByTestId("teach-result").last();
  await expect(fb.getByLabel("4 out of 5 stars")).toBeVisible();
  await expect(fb).toContainText("Knowa asks: Can you give me an example?");
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/teach.png` });

  // The teacher switches the tutor off for the class
  await go(t, "/settings");
  await t.getByText("8-A").first().click();
  await t.getByLabel("AI tutor for students").uncheck();
  await expect(t.getByText("AI tutor switched off")).toBeVisible();
  await go(s, `${classUrl}/ask`);
  await expect(s.getByTestId("tutor")).toContainText("switched the AI tutor off");
});
