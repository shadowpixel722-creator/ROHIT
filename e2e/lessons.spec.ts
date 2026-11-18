import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function person(browser: Browser, role: "Teacher" | "Student", name: string, viewport?: { width: number; height: number }) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  await go(page, "/register");
  await page.getByRole("radio", { name: role }).click();
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

test("narrated 3D lessons: offered for the class level, played step by step with notes, model and quiz", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Iyer");
  await t.getByLabel("Class name").fill("8-L");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  // A note in a chapter that has a 3D lesson, so its Explain page links to it
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "7. Particulate Nature of Matter" });
  await t.getByLabel("Title").fill("Atoms lesson");
  await t.getByLabel("Typed notes").fill("Everything is made of tiny particles called atoms. Atoms join to make molecules.");
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();

  const s = await person(browser, "Student", "Kiran");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();

  // The Explain tab offers the lessons written for Class 8 (not the Class 9–10-only ones)
  await go(s, `${classUrl}/explain`);
  const cards = s.getByTestId("lesson-card");
  await expect(cards.filter({ hasText: "Bohr's atom" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "Quadratic equations" })).toHaveCount(0);
  // ...and the chapter page links to its lesson
  await s.getByTestId("explain-chapter").filter({ hasText: "Particulate Nature of Matter" }).getByRole("link").click();
  await s.getByTestId("chapter-3d-lesson").click();
  await expect(s).toHaveURL(/\/explain\/lesson\/atom$/);

  const player = s.getByTestId("lesson-player");
  await expect(s.getByTestId("lesson-stage")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await s.getByTestId("lesson-start").click();
  await expect(player).toHaveAttribute("data-state", "playing");
  // Step 1: the tutor speaks (captions), writes on the notepad and sets up the model
  await expect(s.getByTestId("lesson-caption")).toContainText("tiny, dense nucleus");
  await expect(s.getByTestId("lesson-notepad")).toContainText("1 proton in the nucleus", { timeout: 20_000 });
  await expect(s.getByTestId("lesson-readout")).toContainText("Hydrogen", { timeout: 20_000 }); // the tutor slides Z from 6 down to 1
  await expect(s.getByTestId("lesson-controls").getByLabel("Atomic number Z")).toBeVisible();
  // Pause and resume
  await s.getByTestId("lesson-pause").click();
  await expect(player).toHaveAttribute("data-state", "paused");
  await s.getByTestId("lesson-pause").click();
  await expect(player).toHaveAttribute("data-state", "playing");
  // Skip ahead: the earlier steps are filled in at once, and the model follows (carbon, Z = 6)
  await s.getByRole("button", { name: "Next step" }).click();
  await expect(s.getByTestId("lesson-step")).toHaveText("Step 2 of 9");
  await expect(s.getByTestId("lesson-notepad")).toContainText("Hydrogen");
  await expect(s.getByTestId("lesson-readout")).toContainText("Carbon", { timeout: 20_000 });
  // The student can take over the model: moving the slider pauses the tutor
  await s.getByTestId("lesson-controls").getByLabel("Atomic number Z").fill("11");
  await expect(s.getByTestId("lesson-readout")).toContainText("Sodium");
  await expect(player).toHaveAttribute("data-state", "paused");
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/lesson-atom.png` });

  // The quick check: fixed questions, marked on the device
  await s.getByTestId("lesson-quiz-tab").click();
  const quiz = s.getByTestId("lesson-quiz");
  await quiz.getByRole("button", { name: "2, 8, 2" }).click();
  await quiz.getByRole("button", { name: "2", exact: true }).click();
  await quiz.getByRole("button", { name: "17", exact: true }).click();
  await expect(quiz).toContainText("You got 2 of 3.");
  await expect(quiz).toContainText("A = protons + neutrons");

  // A lesson without a 3D model plays on the notepad (no stage)
  await go(s, `${classUrl}/explain/lesson/voice`);
  await expect(s.getByTestId("lesson-stage")).toHaveCount(1); // voice has a model
  await go(s, `${classUrl}/explain/lesson/nope`);
  await expect(s.getByText(/could not be found|not found|404/i).first()).toBeVisible();

  // On a phone the player fits the screen
  const phone = await s.context().newPage();
  await phone.setViewportSize({ width: 375, height: 760 });
  await go(phone, `${classUrl}/explain/lesson/lens`);
  await expect(phone.getByTestId("lesson-stage")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.SHOTS_DIR) await phone.screenshot({ path: `${process.env.SHOTS_DIR}/lesson-phone.png`, fullPage: true });
  await phone.close();

  // Outsiders can't open a class's lessons
  const o = await person(browser, "Student", "Zoya");
  await go(o, `${classUrl}/explain/lesson/atom`);
  await expect(o.getByText(/could not be found|not found|404/i).first()).toBeVisible();
});
