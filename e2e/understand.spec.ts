import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const NOTES = "Coal is a fossil fuel. It formed from the remains of ancient plants buried under the earth for millions of years. It is non-renewable, so we must use it carefully.";
const RIGHT: Record<string, string> = {
  "Is coal a renewable resource?": "No, it took millions of years to form",
  "What was coal formed from?": "Remains of ancient plants",
  "Why should we use coal carefully?": "It will run out one day",
};

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const page = await (await browser.newContext()).newPage();
  page.on("dialog", (d) => d.accept());
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

test("without a class: home offers 3D lessons, they play, and a step can be explained (no AI)", async ({ browser }) => {
  const s = await person(browser, "Student", "Solo Learner");
  await go(s, "/dashboard");
  await expect(s.getByTestId("no-class-home")).toBeVisible();
  await expect(s.getByTestId("lesson-card")).toHaveCount(6);
  await s.getByRole("link", { name: "All 3D lessons" }).click();
  await expect(s.getByTestId("lessons-page")).toBeVisible();
  await s.getByRole("link", { name: "8", exact: true }).click();
  await expect(s).toHaveURL(/class=8/);
  await expect(s.getByTestId("lesson-card").filter({ hasText: "Quadratic equations" })).toHaveCount(0); // Class 9–10 only
  await s.getByTestId("lesson-card").filter({ hasText: "Bohr's atom" }).click();
  await expect(s).toHaveURL(/\/lessons\/atom$/);
  await expect(s.getByTestId("lesson-player")).toBeVisible();
  await s.getByRole("button", { name: /Start the lesson/ }).click();
  await s.getByTestId("understand").click();
  const panel = s.getByTestId("understand-panel");
  await expect(panel).toContainText("written out");
  await expect(panel.getByTestId("understand-why")).toHaveCount(0); // no class, so simply no AI: nothing to apologise for
  await go(s, "/lessons/nope");
  await expect(s.getByText(/not found|404/i).first()).toBeVisible();
});

test("I don't understand: MCQs, quizzes and explanations; leaderboard with the teacher's switch", async ({ browser }) => {
  const t = await person(browser, "Teacher", "Ms Das");
  await t.getByLabel("Class name").fill("8-U");
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
  // Multiple-choice and written questions (fake AI), approved
  await go(t, `${classUrl}/study`);
  const chapterHref = (await t.getByTestId("study-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").getAttribute("href"))!;
  await go(t, chapterHref);
  await t.getByTestId("mcq-generate-all").click();
  await t.getByTestId("mcq-drafts").getByRole("button", { name: "Approve all" }).click();
  await t.getByTestId("generate-all").click();
  await t.getByRole("button", { name: "Approve all drafts" }).click();
  await expect(t.getByTestId("drafts-banner")).toHaveCount(0);

  // A unique name: the test database keeps students from earlier runs, who may outrank her
  const ashaName = `Asha ${uid()}`;
  const asha = await person(browser, "Student", ashaName);
  const ravi = await person(browser, "Student", "Ravi Shah");
  for (const p of [asha, ravi]) {
    await p.getByLabel("Class code").fill(code);
    await p.getByRole("button", { name: "Join class" }).click();
    await expect(p.getByText(/You joined/)).toBeVisible();
  }
  await go(t, classUrl);
  await t.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Confirm form received" }).click();
  await expect(t.getByText("Consent confirmed")).toBeVisible();

  // --- Asha (consent confirmed): the AI explains the question without the answer, then the answer after
  await go(asha, chapterHref);
  await asha.getByTestId("mcq-start").first().click();
  const q = asha.getByTestId("mcq-question");
  const stem = (await q.locator("p.font-medium").first().textContent())!.trim();
  await q.getByTestId("understand").click();
  const before = q.getByTestId("understand-panel");
  await expect(before).toContainText("In simpler words");
  await expect(before).toContainText("this is asking about");
  await expect(before).not.toContainText(RIGHT[stem]);
  await q.getByRole("button", { name: new RegExp(RIGHT[stem].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await q.getByTestId("confidence").getByRole("button", { name: "Sure" }).click();
  await expect(asha.getByTestId("mcq-feedback")).toContainText("Right!");
  await q.getByRole("button", { name: "I still don't understand" }).click();
  await expect(q.getByTestId("understand-panel")).toContainText(RIGHT[stem]);

  // --- Ravi (consent not confirmed): no AI, the saved class note instead, with the reason
  await go(ravi, chapterHref);
  await ravi.getByTestId("mcq-start").first().click();
  await ravi.getByTestId("mcq-question").getByTestId("understand").click();
  const saved = ravi.getByTestId("understand-panel");
  await expect(saved.getByTestId("understand-why")).toContainText("consent");
  await expect(saved).toContainText("From your class notes: Coal notes");
  await expect(saved).not.toContainText("In simpler words");

  // --- Written quiz question (Asha): explained before answering
  await go(asha, chapterHref);
  await asha.getByRole("checkbox", { name: /Coal notes/ }).check();
  await asha.getByRole("button", { name: "Start quiz" }).click();
  const wq = asha.getByTestId("quiz-question").first();
  await wq.getByTestId("understand").click();
  await expect(wq.getByTestId("understand-panel")).toContainText("this is asking about");

  // --- Explain tab: the explanation can be explained more simply
  await go(asha, `${classUrl}/explain`);
  await asha.getByTestId("explain-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").click();
  await expect(asha.getByTestId("lesson-summary")).toBeVisible({ timeout: 30_000 });
  await asha.getByRole("button", { name: "I don't understand this explanation" }).click();
  await expect(asha.getByTestId("understand-panel")).toContainText("In simpler words");

  // --- Leaderboard: Asha's right answer ranks her on the perfect-answers board (in the top 10 or below it)
  const solo = await person(browser, "Student", "Solo Watcher");
  await go(solo, "/leaderboard");
  await expect(solo.getByTestId("board-perfect")).toBeVisible();
  await expect(solo.getByTestId("board-perfect").getByTestId("my-rank")).toContainText("not on this board yet");
  await go(asha, "/leaderboard");
  const mine = asha.getByTestId("board-perfect");
  await expect(mine.getByText(`${ashaName} (you)`).or(mine.getByTestId("my-rank").filter({ hasText: /You're #\d+ with 1 perfect/ }))).toBeVisible();

  // The teacher switches it off for the class: her students leave the board and can't see it
  await go(t, "/settings");
  const item = t.getByTestId("class-settings-item").filter({ hasText: "8-U" });
  if (!(await item.getByLabel("Leaderboard for students").isVisible())) await item.locator("summary").first().click();
  await item.getByLabel("Leaderboard for students").uncheck();
  await expect(t.getByText("Leaderboard switched off")).toBeVisible();
  await go(asha, "/leaderboard");
  await expect(asha.getByText("The leaderboard is off for your class")).toBeVisible();
  await go(solo, "/leaderboard");
  await expect(solo.getByTestId("board-perfect")).not.toContainText(ashaName);
  await expect(solo.getByTestId("board-perfect")).toBeVisible(); // students without a class still see it
});
