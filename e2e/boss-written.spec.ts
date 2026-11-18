import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const NOTES = "Coal is a fossil fuel. It formed from the remains of ancient plants buried under the earth for millions of years. It is non-renewable, so we must use it carefully.";
const RIGHT: Record<string, string> = {
  "Is coal a renewable resource?": "No, it took millions of years to form",
  "What was coal formed from?": "Remains of ancient plants",
  "Why should we use coal carefully?": "It will run out one day",
};
// Covers every fake written question's key points, so the (fake) marker gives full marks
const GOOD = "Plants were buried for millions of years. It takes millions of years and will finish one day. It is burned to make electricity.";
const BAD = "i like cricket a lot";

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

test("Boss Battles include written questions, marked like the written quizzes, and they feed the Mistake Map's topic map", async ({ browser }) => {
  test.setTimeout(180_000);
  const t = await person(browser, "Teacher", "Mr Rao");
  await t.getByLabel("Class name").fill("8-W");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t, `${classUrl}/new`);
  await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.getByLabel("Title").fill("Coal notes");
  await t.getByLabel("Typed notes").fill(NOTES);
  await t.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.getByText("Note added to the class notebook")).toBeVisible();
  // 3 written questions and 3 multiple-choice questions, all approved: 6 questions, enough for a boss
  await go(t, `${classUrl}/study`);
  const chapterHref = (await t.getByTestId("study-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").getAttribute("href"))!;
  await go(t, chapterHref);
  await t.getByTestId("generate-all").click();
  await expect(t.getByTestId("drafts-banner")).toContainText("3 items are waiting");
  await t.getByRole("button", { name: "Approve all drafts" }).click();
  await expect(t.getByTestId("drafts-banner")).toHaveCount(0);
  await t.getByTestId("mcq-generate-all").click();
  await expect(t.getByTestId("mcq-drafts")).toContainText("3 questions to check");
  await t.getByTestId("mcq-drafts").getByRole("button", { name: "Approve all" }).click();
  await expect(t.getByTestId("mcq-drafts")).toHaveCount(0);

  const s = await person(browser, "Student", "Asha");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();

  // Without a confirmed consent form, the written half of this boss isn't available
  await go(s, `${classUrl}/boss`);
  await expect(s.getByTestId("boss-card").filter({ hasText: "Exploring Forces" })).toContainText("6 questions (3 written)");
  await s.getByTestId("boss-card").filter({ hasText: "Exploring Forces" }).click();
  await expect(s.getByTestId("boss-game")).toHaveAttribute("data-phase", "error", { timeout: 15_000 });
  await expect(s.getByTestId("boss-game")).toContainText("consent form");
  await s.getByRole("button", { name: "Back" }).click();

  await go(t, classUrl);
  await t.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Confirm form received" }).click();
  await expect(t.getByText("Consent confirmed")).toBeVisible();

  // Fight: multiple choice answered right; the first written answer is a good one, later ones are not
  await go(s, `${classUrl}/boss`);
  await s.getByTestId("boss-card").filter({ hasText: "Exploring Forces" }).click();
  const game = s.getByTestId("boss-game");
  await expect(game).toHaveAttribute("data-phase", "pick", { timeout: 15_000 });
  await expect(game).toContainText("Written questions");
  let written = 0;
  for (let i = 0; i < 60; i++) {
    const phase = await game.getAttribute("data-phase");
    if (phase === "end") break;
    if (phase === "pick") {
      const chips = game.getByRole("group", { name: "Energy to spend" }).getByRole("button");
      const enabled = await chips.evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).disabled).length);
      if (enabled === 0) { await game.getByTestId("boss-charge").click(); await s.waitForTimeout(300); continue; }
      await chips.nth(Math.min(enabled, 5) - 1).click();
      await game.getByTestId("boss-attack").click();
    } else if (phase === "ask") {
      const w = game.getByTestId("boss-written");
      if (await w.isVisible() && await game.getByTestId("boss-strike").isVisible()) {
        written++;
        await w.getByLabel("Your answer").fill(written === 1 ? GOOD : BAD);
        await game.getByTestId("boss-strike").click();
        await expect(w).toContainText("Model answer:", { timeout: 15_000 });
        await expect(w).toContainText(written === 1 ? "CORRECT" : "NOT QUITE");
        if (written === 1 && process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/boss-written.png` });
      } else if (!(await w.isVisible())) {
        const stem = (await game.locator(".bg-qt").textContent())!.trim();
        const opt = game.locator(".opt", { hasText: RIGHT[stem] });
        if (await opt.isEnabled()) await opt.click();
      }
      const next = game.getByTestId("boss-next");
      await expect(next.or(game.getByTestId("boss-end"))).toBeVisible({ timeout: 15_000 });
      if (await next.isVisible()) await next.click();
    }
    await s.waitForTimeout(250);
  }
  await expect(game.getByTestId("boss-end")).toBeVisible();
  expect(written).toBeGreaterThan(0);
  await s.getByRole("button", { name: "Back to bosses" }).click();

  // The written answers count as quiz answers: wrong ones appear in the Mistake Map, on the topic map too
  await go(s, `${classUrl}/mistakes`);
  if (written > 1) {
    await expect(s.getByTestId("quiz-mistakes")).toContainText(BAD);
    await expect(s.getByTestId("topic-map").getByTestId("written-node").first()).toBeVisible();
    await s.getByTestId("topic-map").getByTestId("written-node").first().click();
    await expect(s.getByTestId("topic-details")).toContainText("Written answer to fix");
    if (process.env.SHOTS_DIR) await s.getByTestId("topic-map-section").screenshot({ path: `${process.env.SHOTS_DIR}/map-written.png` });
  }
  await expect(s.getByTestId("topic-map").getByTestId("topic-node")).toHaveCount(1);
});
