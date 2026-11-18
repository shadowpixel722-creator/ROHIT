import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
// The fake AI highlights "fossil fuel", "remains of ancient plants", "millions of years" and "non-renewable".
const NOTES = "## Coal\nCoal is a **fossil fuel**. It formed from the remains of ancient plants buried under the earth for millions of years.\n## Saving it\nCoal is non-renewable, so we must use it carefully.";

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

test("Explain tab: summary, key points, explanation in the notes' order, and highlighted notes", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Iyer");
  await t.getByLabel("Class name").fill("8-E");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill("Coal lesson");
  await t.getByLabel("Typed notes").fill(NOTES);
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();

  const s = await person(browser, "Student", "Asha");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();

  // Student picks the lesson from the Explain tab; the explanation is written on first visit
  await go(s, `${classUrl}/explain`);
  await s.getByTestId("explain-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").click();
  const lesson = s.getByTestId("lesson").filter({ hasText: "Coal lesson" });
  await expect(lesson.getByTestId("lesson-summary")).toContainText("fossil fuel that took millions of years", { timeout: 20_000 });
  await expect(lesson.getByTestId("lesson-keypoints").locator("li")).toHaveCount(4);
  // The explanation follows the notes' own order
  const headings = await lesson.getByTestId("lesson-explained").locator("li p.font-semibold").allTextContents();
  expect(headings).toEqual(["What coal is", "Why we must save it"]);
  // Her notes are shown with every key phrase highlighted (CSS highlights, notes' HTML untouched)
  await expect(lesson.getByTestId("lesson-notes")).toContainText("remains of ancient plants");
  await expect(lesson.getByTestId("lesson-notes")).toHaveAttribute("data-highlights", "4");
  expect(await s.evaluate(() => (CSS as unknown as { highlights: Map<string, unknown> }).highlights.has("keypoint"))).toBe(true);
  await expect(s.getByRole("button", { name: "Remake" })).toHaveCount(0); // teachers only
  // The explanation can be listened to as a narrated notepad lesson (no 3D model, no new AI call)
  await lesson.getByTestId("listen-lesson").click();
  await expect(s.getByTestId("lesson-stage")).toHaveCount(0);
  await s.getByTestId("lesson-start").click();
  await expect(s.getByTestId("lesson-notepad")).toContainText("In short", { timeout: 20_000 });
  await expect(s.getByTestId("lesson-caption")).toContainText("fossil fuel");
  await s.goBack();
  await s.waitForLoadState("networkidle");

  // Reading: bigger text (remembered on this device) and full screen
  const reading = lesson.getByTestId("reading-view");
  const zoom = () => reading.getByTestId("reading-content").evaluate((el) => getComputedStyle(el).zoom);
  await expect(reading.getByTestId("text-size")).toHaveText("100%");
  await reading.getByTestId("text-bigger").click();
  await reading.getByTestId("text-bigger").click();
  await expect(reading.getByTestId("text-size")).toHaveText("130%");
  expect(await zoom()).toBe("1.3");
  await reading.getByTestId("read-fullscreen").click();
  await expect(reading).toHaveAttribute("data-full", "true");
  const box = (await reading.boundingBox())!;
  const vp = s.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
  expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
  await expect(reading.getByRole("dialog").or(s.getByRole("dialog", { name: /Reading: Coal lesson/ }))).toBeVisible();
  await expect(lesson.getByTestId("lesson-notes")).toHaveAttribute("data-highlights", "4"); // highlights still work
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/explain-fullscreen.png` });
  await s.keyboard.press("-");
  await expect(reading.getByTestId("text-size")).toHaveText("115%");
  await s.keyboard.press("Escape");
  await expect(reading).toHaveAttribute("data-full", "false");
  await s.reload();
  await expect(s.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByTestId("text-size")).toHaveText("115%");
  await s.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByLabel("Reset text size").click();
  await expect(s.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByTestId("text-size")).toHaveText("100%");

  // On a phone: full screen fills the screen, bigger text re-wraps (no sideways scrolling)
  const phone = await s.context().newPage();
  await phone.setViewportSize({ width: 375, height: 740 });
  await go(phone, s.url());
  const pr = phone.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByTestId("reading-view");
  await pr.getByTestId("text-bigger").click();
  await pr.getByTestId("text-bigger").click();
  await pr.getByTestId("read-fullscreen").click();
  await expect(pr).toHaveAttribute("data-full", "true");
  expect(await pr.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  if (process.env.SHOTS_DIR) await phone.screenshot({ path: `${process.env.SHOTS_DIR}/explain-fullscreen-phone.png` });
  await pr.getByTestId("exit-fullscreen").click();
  await expect(pr).toHaveAttribute("data-full", "false");
  await pr.getByLabel("Reset text size").click();
  await phone.close();

  // The note page links straight to its explanation; it is reused, not written again
  await go(s, classUrl + "/notebook");
  await s.getByTestId("note-card").first().click();
  await s.getByRole("link", { name: "Explain this lesson →" }).click();
  await expect(s).toHaveURL(/#lesson-/);
  await expect(s.getByTestId("lesson-summary")).toBeVisible();
  await expect(s.getByTestId("explain-loading")).toHaveCount(0);

  // Teacher can remake it
  await go(t, `${classUrl}/explain`);
  await t.getByTestId("explain-chapter").first().getByRole("link").click();
  await t.getByRole("button", { name: "Remake" }).click();
  await expect(t.getByText("New explanation made")).toBeVisible();

  // Outsiders get nothing
  const o = await person(browser, "Student", "Zoya");
  await go(o, `${classUrl}/explain`);
  await expect(o.getByText(/could not be found|not found|404/i).first()).toBeVisible();
});
