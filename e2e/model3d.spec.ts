import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
// Clearly about the solar system, so it gets the hand-built model (no AI).
const ATOM = "## The solar system\nThe solar system has the Sun and eight planets. Jupiter is the largest planet and Saturn has rings. Every planet moves in an orbit.";
// Matches no hand-built model, so the (fake) AI builds one.
const COAL = "## Coal\nCoal is a **fossil fuel**. It formed from the remains of ancient plants buried under the earth for millions of years.";

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

async function addNote(t: Page, classUrl: string, title: string, text: string) {
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill(title);
  await t.getByLabel("Typed notes").fill(text);
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();
}

test("Explain tab: lessons in 3D, from the hand-built library or built by AI", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Rao");
  await t.getByLabel("Class name").fill("8-F");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await addNote(t, classUrl, "The solar system", ATOM);
  await addNote(t, classUrl, "Coal lesson", COAL);

  const s = await person(browser, "Student", "Meera");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();
  await go(s, `${classUrl}/explain`);
  await s.getByTestId("explain-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").click();
  await s.waitForLoadState("networkidle");

  // Atom lesson: nothing is made until asked; then the hand-built model opens straight away
  const atom = s.getByTestId("lesson").filter({ hasText: "The solar system" }).getByTestId("lesson-3d");
  await expect(atom.getByTestId("model3d-viewer")).toHaveCount(0);
  await atom.getByTestId("show-3d").click();
  await expect(atom.getByText("Hand-built model")).toBeVisible();
  const viewer = atom.getByTestId("model3d-viewer");
  await expect(viewer).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(viewer.locator("canvas")).toBeVisible();
  // Labels float over the model (crowded ones give way); repeated parts are listed once with a count
  await expect(viewer.getByTestId("model3d-labels").getByRole("button", { name: "Sun", exact: true })).toBeVisible();
  await expect(viewer.getByTestId("model3d-parts")).toContainText("Saturn");
  await expect(s.getByRole("button", { name: /Remake with AI|Make one with AI instead/ })).toHaveCount(0); // teachers only

  // Tap a part in the list to read about it
  await viewer.getByTestId("model3d-parts").getByRole("button", { name: "Earth", exact: true }).click();
  await expect(viewer.getByTestId("model3d-info")).toContainText("third from the Sun");
  // Tapping the middle of the model picks whatever is there (the Sun, or a planet passing in front)
  await viewer.getByLabel("Close", { exact: true }).click();
  const box = (await viewer.locator("canvas").boundingBox())!;
  await s.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(viewer.getByTestId("model3d-info")).toContainText(/Sun|planet/);
  // Dragging turns the model without selecting anything new
  await s.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await s.mouse.down();
  await s.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, { steps: 8 });
  await s.mouse.up();

  // Guided tour
  await viewer.getByRole("button", { name: "Start guided tour" }).click();
  await expect(viewer.getByTestId("model3d-step")).toContainText("The Sun is at the centre");
  await viewer.getByRole("button", { name: "Next" }).click();
  await expect(viewer.getByTestId("model3d-step")).toContainText("inner planets");
  await viewer.getByRole("button", { name: "Pause motion" }).click();
  await expect(viewer.getByRole("button", { name: "Play motion" })).toBeVisible();
  if (process.env.SHOTS_DIR) await viewer.screenshot({ path: `${process.env.SHOTS_DIR}/model3d-atom.png` });

  // Full screen fills the screen; Esc closes it
  await viewer.getByRole("button", { name: "Full screen" }).click();
  const fb = (await viewer.boundingBox())!;
  expect(fb.width).toBeGreaterThanOrEqual(s.viewportSize()!.width - 1);
  await s.keyboard.press("Escape");
  await expect(viewer.getByRole("button", { name: "Full screen" })).toBeVisible();

  // Coal lesson: no hand-built model fits, so the AI builds one (fake AI in tests)
  const coal = s.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByTestId("lesson-3d");
  await coal.getByTestId("show-3d").click();
  await expect(coal.getByText("Built by AI. May contain mistakes")).toBeVisible({ timeout: 20_000 });
  await expect(coal.getByTestId("model3d-viewer")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  await expect(coal.getByTestId("model3d-parts")).toContainText("Coal seam");
  if (process.env.SHOTS_DIR) await coal.getByTestId("model3d-viewer").screenshot({ path: `${process.env.SHOTS_DIR}/model3d-coal.png` });

  // Saved for the class: after a reload it opens without being made again
  await s.reload();
  await s.waitForLoadState("networkidle");
  const again = s.getByTestId("lesson").filter({ hasText: "Coal lesson" }).getByTestId("lesson-3d");
  await expect(again.getByTestId("show-3d")).toHaveCount(0);
  await again.getByTestId("open-3d").click();
  await expect(again.getByTestId("model3d-viewer")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });

  // On a phone: the viewer fits the screen (no sideways scrolling)
  const phone = await s.context().newPage();
  await phone.setViewportSize({ width: 375, height: 740 });
  await go(phone, s.url());
  const pa = phone.getByTestId("lesson").filter({ hasText: "The solar system" }).getByTestId("lesson-3d");
  await pa.getByTestId("open-3d").click();
  await expect(pa.getByTestId("model3d-viewer")).toHaveAttribute("data-ready", "true", { timeout: 20_000 });
  expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (process.env.SHOTS_DIR) await phone.screenshot({ path: `${process.env.SHOTS_DIR}/model3d-phone.png`, fullPage: false });
  await phone.close();

  // Teacher: swap the library model for an AI one, and back
  await go(t, `${classUrl}/explain`);
  await t.getByTestId("explain-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").click();
  await t.waitForLoadState("networkidle");
  const ta = t.getByTestId("lesson").filter({ hasText: "The solar system" }).getByTestId("lesson-3d");
  await ta.getByRole("button", { name: "Make one with AI instead" }).click();
  await expect(t.getByText("New 3D model made")).toBeVisible();
  await expect(ta.getByText("Built by AI. May contain mistakes")).toBeVisible();
  await ta.getByRole("button", { name: "Use the hand-built model" }).click();
  await expect(t.getByText("Switched to the hand-built model")).toBeVisible();
  await expect(ta.getByText("Hand-built model")).toBeVisible();
});
