import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const NOTES = "Coal is a fossil fuel. It formed from the remains of ancient plants buried under the earth for millions of years. It is non-renewable, so we must use it carefully.";
// The fake AI's questions and their right answers
const RIGHT: Record<string, string> = {
  "Is coal a renewable resource?": "No, it took millions of years to form",
  "What was coal formed from?": "Remains of ancient plants",
  "Why should we use coal carefully?": "It will run out one day",
};

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

/** Plays the open battle to its end, always answering right and spending the most energy. */
async function playOut(page: Page) {
  const game = page.getByTestId("boss-game");
  for (let i = 0; i < 40; i++) {
    const phase = await game.getAttribute("data-phase");
    if (phase === "end") return;
    if (phase === "pick") {
      const chips = game.getByRole("group", { name: "Energy to spend" }).getByRole("button");
      const enabled = await chips.evaluateAll((els) => els.filter((e) => !(e as HTMLButtonElement).disabled).length);
      if (enabled === 0) { await game.getByTestId("boss-charge").click(); await page.waitForTimeout(300); continue; }
      await chips.nth(enabled - 1).click();
      await game.getByTestId("boss-attack").click();
    } else if (phase === "ask") {
      const stem = (await game.locator(".bg-qt").textContent())!.trim();
      const opt = game.locator(".opt", { hasText: RIGHT[stem] });
      if (await opt.isEnabled()) await opt.click();
      const next = game.getByTestId("boss-next");
      await expect(next.or(game.getByTestId("boss-end"))).toBeVisible({ timeout: 15_000 });
      if (await next.isVisible()) await next.click();
    }
    await page.waitForTimeout(250);
  }
  throw new Error("battle didn't finish");
}

test("streaks, XP and coins from learning; Boss Battles on approved questions; the shop; team raids", async ({ browser }) => {
  test.setTimeout(180_000);
  const t = await person(browser, "Teacher", "Mr Rao");
  await t.getByLabel("Class name").fill("8-G");
  await t.getByRole("button", { name: "Create class" }).click();
  await expect(t.getByTestId("join-code")).toBeVisible();
  const classUrl = t.url();
  const code = (await t.getByTestId("join-code").textContent())!;
  await t.getByRole("button", { name: "+ Science" }).click();
  await expect(t.getByText(/Science added with \d+ chapters/)).toBeVisible();
  for (const title of ["Coal notes", "More coal notes"]) {
    await go(t, `${classUrl}/new`);
    await t.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
    await t.getByLabel("Title").fill(title);
    await t.getByLabel("Typed notes").fill(NOTES);
    await t.getByRole("button", { name: "Add to notebook" }).click();
    await expect(t.getByText("Note added to the class notebook")).toBeVisible();
  }
  await go(t, `${classUrl}/study`);
  const chapterHref = (await t.getByTestId("study-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").getAttribute("href"))!;
  await go(t, chapterHref);
  await t.getByTestId("mcq-generate-all").click();
  await expect(t.getByTestId("mcq-drafts")).toContainText("6 questions to check");
  await t.getByTestId("mcq-drafts").getByRole("button", { name: "Approve all" }).click();
  await expect(t.getByTestId("mcq-drafts")).toHaveCount(0);

  const s = await person(browser, "Student", "Asha");
  await s.getByLabel("Class code").fill(code);
  await s.getByRole("button", { name: "Join class" }).click();
  await expect(s.getByText(/You joined/)).toBeVisible();
  // No learning yet: no streak, 60 starting coins
  await expect(s.getByTestId("game-chip").first()).toContainText("0");
  await expect(s.getByTestId("game-chip").first()).toContainText("60");

  // One practice answer starts the streak (and the day's first learning gives 10 coins)
  await go(s, chapterHref);
  await s.getByTestId("mcq-start").first().click();
  const q = s.getByTestId("mcq-question");
  const stem = (await q.locator("p.font-medium").first().textContent())!.trim();
  await q.getByRole("button", { name: RIGHT[stem] }).click();
  await q.getByTestId("confidence").getByRole("button", { name: "Sure" }).click();
  await expect(s.getByTestId("mcq-feedback")).toContainText("Right!");
  await go(s, "/hero");
  await expect(s.getByTestId("streak-count")).toHaveText("1 day");
  await expect(s.getByTestId("coins")).toContainText("70 coins");
  await expect(s.getByTestId("level-card")).toContainText("5 XP");
  await expect(s.getByTestId("game-chip").first()).toContainText("1");

  // Boss Battles: the chapter has 6 approved questions, so it has a boss; fight and win
  await go(s, `${classUrl}/boss`);
  await s.getByTestId("boss-card").filter({ hasText: "Exploring Forces" }).click();
  await expect(s.getByTestId("boss-game")).toHaveAttribute("data-phase", "pick", { timeout: 15_000 });
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/boss-pick.png` });
  // Can't spend energy you don't have (you start with 5)
  await expect(s.getByRole("group", { name: "Energy to spend" }).getByRole("button", { name: "6", exact: true })).toBeDisabled();
  await playOut(s);
  await expect(s.getByTestId("boss-end")).toContainText("VICTORY!");
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/boss-win.png` });
  await s.getByRole("button", { name: "Back to bosses" }).click();
  await expect(s.getByTestId("boss-card").filter({ hasText: "Exploring Forces" })).toContainText("Beaten ×1");

  // The shop: spend coins on a cosmetic, which is then worn
  await go(s, "/hero");
  const before = Number((await s.getByTestId("coins").textContent())!.match(/\d+/)![0]);
  expect(before).toBeGreaterThanOrEqual(130);
  await s.getByTestId("shop-item").filter({ hasText: "Crimson" }).click();
  await s.getByTestId("shop-buy").click();
  await expect(s.getByText("You bought Crimson!")).toBeVisible();
  await expect(s.getByTestId("coins")).toContainText(`${before - 60} coins`);
  await expect(s.getByTestId("shop-item").filter({ hasText: "Crimson" })).toContainText("Equipped");
  if (process.env.SHOTS_DIR) await s.screenshot({ path: `${process.env.SHOTS_DIR}/hero.png`, fullPage: true });

  // Team raid: start one, play your 8 turns, your damage shows on the class board; one go per player
  await go(s, `${classUrl}/boss`);
  await s.getByTestId("raid-start").click();
  await expect(s.getByText("Raid started. Tell your classmates!")).toBeVisible();
  await s.getByTestId("raid-row").first().getByTestId("raid-join").click();
  await expect(s.getByTestId("boss-game")).toHaveAttribute("data-phase", "pick", { timeout: 15_000 });
  await playOut(s);
  await expect(s.getByTestId("boss-end")).toContainText("RAID TURNS OVER");
  await s.getByRole("button", { name: "Back to bosses" }).click();
  const raid = s.getByTestId("raid-row").first();
  await expect(raid).toContainText("Asha (you)");
  await expect(raid).toContainText("You've played");
  await expect(raid.getByTestId("raid-join")).toHaveCount(0);
  // ...and the teacher sees the same board
  await go(t, `${classUrl}/boss`);
  await expect(t.getByTestId("raid-row").first()).toContainText("Asha");
});
