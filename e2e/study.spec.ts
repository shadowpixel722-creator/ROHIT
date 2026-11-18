import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const plusDays = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const NOTES = "Coal and petroleum are fossil fuels. They formed from the remains of plants and tiny sea animals that were buried under the earth for millions of years. Fossil fuels are non-renewable, so they will finish one day.";

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function signUp(page: Page, role: "Teacher" | "Student", name: string) {
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
}

async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await signUp(page, role, name);
  return { ctx, page };
}

async function join(page: Page, code: string) {
  await page.getByLabel("Class code").fill(code);
  await page.getByRole("button", { name: "Join class" }).click();
  await expect(page.getByText(/You joined/)).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test("calendar, flashcards and written-answer quizzes: teacher sets up, student practises", async ({ browser }) => {
  // --- Teacher: class, subject (NCERT chapters load automatically), and one approved typed note
  const t = await person(browser, "Teacher", "Mr Sharma");
  await t.page.getByLabel("Class name").fill("8-C");
  await t.page.getByRole("button", { name: "Create class" }).click();
  await expect(t.page.getByTestId("join-code")).toBeVisible();
  const classUrl = t.page.url();
  const code = (await t.page.getByTestId("join-code").textContent())!;
  await t.page.getByRole("button", { name: "+ Science" }).click();
  await expect(t.page.getByText(/Science added with \d+ chapters/)).toBeVisible();

  await go(t.page, `${classUrl}/new`);
  await t.page.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.page.getByLabel("Title").fill("Forces: class notes");
  await t.page.getByLabel("Typed notes").fill(NOTES);
  await t.page.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.page.getByText("Note added to the class notebook")).toBeVisible();

  const asha = await person(browser, "Student", "Asha");
  await join(asha.page, code);
  const outsider = await person(browser, "Student", "Meera");

  // --- Teacher puts a test on the calendar for 2 days from now
  await go(t.page, `${classUrl}/calendar`);
  await expect(t.page.getByTestId("assessment-form")).toBeVisible();
  await t.page.getByLabel("Title").fill("Unit 2 test");
  await t.page.getByLabel("Date", { exact: true }).fill(plusDays(2));
  await t.page.getByLabel("5. Exploring Forces").check();
  await t.page.getByRole("button", { name: "Add to calendar" }).click();
  await expect(t.page.getByText("Test added to the calendar")).toBeVisible();
  await expect(t.page.getByTestId("upcoming-list")).toContainText("Unit 2 test");
  await expect(t.page.getByTestId("upcoming-list")).toContainText("In 2 days");

  // A past date is refused by the date picker itself (the server checks again)
  await t.page.getByLabel("Date", { exact: true }).fill("2020-01-01");
  expect(await t.page.getByLabel("Date", { exact: true }).evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);

  // --- Student can only look: no form, no edit buttons, and a reminder because the test is close
  await go(asha.page, `${classUrl}/calendar`);
  await expect(asha.page.getByTestId("assessment-form")).toHaveCount(0);
  await expect(asha.page.getByRole("button", { name: /^Edit|^Delete/ })).toHaveCount(0);
  await expect(asha.page.getByTestId("upcoming-list")).toContainText("Unit 2 test");
  await expect(asha.page.getByTestId("upcoming-list")).toContainText("Not started");
  // The reminder is only on the Overview tab
  await expect(asha.page.getByTestId("urgent-banner")).toHaveCount(0);
  await go(asha.page, classUrl);
  await expect(asha.page.getByTestId("urgent-banner")).toContainText("Unit 2 test");
  await expect(asha.page.getByTestId("upcoming-card")).toContainText("You haven't taken a quiz on");

  // --- Someone outside the class gets nothing
  await go(outsider.page, `${classUrl}/calendar`);
  await expect(outsider.page.getByText(/could not be found|not found|404/i).first()).toBeVisible();

  // --- Teacher makes study material from the approved note (fake AI): drafts first, hidden from students
  await go(t.page, `${classUrl}/study`);
  const row = t.page.getByTestId("study-chapter").filter({ hasText: "Exploring Forces" });
  const chapterHref = (await row.getByRole("link").getAttribute("href"))!;
  await row.getByRole("link").click();
  await t.page.waitForLoadState("networkidle");
  // The Study tab makes written questions only; flashcards live on their own tab
  await t.page.getByTestId("generate-all").click();
  await expect(t.page.getByTestId("drafts-banner")).toContainText("3 items are waiting");
  await expect(t.page.getByTestId("manager-note")).toContainText("3 questions");
  await expect(t.page.getByTestId("flashcard-row")).toHaveCount(0);

  await go(asha.page, chapterHref);
  await expect(asha.page.getByTestId("flashcard-deck")).toHaveCount(0);
  await expect(asha.page.locator("summary", { hasText: /flashcard/i })).toHaveCount(0); // no flashcard section on the Study page

  // Teacher fixes one question by hand, then approves everything
  const q = t.page.getByTestId("question-row").first();
  await q.getByRole("button", { name: "Edit" }).click();
  await t.page.getByLabel("Key points a correct answer should contain").first().fill("plants buried\nmillions of years");
  await t.page.getByRole("button", { name: "Save and approve" }).click();
  await expect(t.page.getByText("Saved and approved")).toBeVisible();
  await t.page.getByRole("button", { name: "Approve all drafts" }).click();
  await expect(t.page.getByTestId("drafts-banner")).toHaveCount(0);

  // --- Flashcards tab: the teacher makes and approves cards there, and the student studies them there
  await go(t.page, `${classUrl}/flashcards`);
  const flashUrl = (await t.page.getByTestId("flashcard-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").getAttribute("href"))!;
  await go(t.page, flashUrl);
  await t.page.getByTestId("generate-all").click();
  await expect(t.page.getByTestId("drafts-banner")).toContainText("3 items are waiting");
  await expect(t.page.getByTestId("manager-note")).toContainText("3 cards");
  await expect(t.page.getByTestId("question-row")).toHaveCount(0);
  await t.page.getByRole("button", { name: "Approve all drafts" }).click();
  await expect(t.page.getByTestId("drafts-banner")).toHaveCount(0);

  await go(asha.page, flashUrl);
  const deck = asha.page.getByTestId("flashcard-deck");
  await expect(deck).toBeVisible();
  const front = await asha.page.getByTestId("flashcard-text").textContent();
  await asha.page.getByTestId("flashcard").click();
  await expect(asha.page.getByTestId("flashcard-text")).not.toHaveText(front!);
  await asha.page.getByRole("button", { name: "Got it" }).click(); // the card is already showing its answer
  for (let i = 0; i < 2; i++) {
    await asha.page.getByTestId("flashcard").click();
    await asha.page.getByRole("button", { name: "Got it" }).click();
  }
  await expect(asha.page.getByTestId("deck-done")).toBeVisible();
  await go(asha.page, chapterHref);

  // --- Written-answer quiz needs the teacher to have confirmed the consent form (the AI reads the answers)
  await expect(asha.page.getByTestId("quiz-blocked")).toContainText("consent");
  await go(t.page, classUrl);
  await t.page.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Confirm form received" }).click();
  await expect(t.page.getByText("Consent confirmed")).toBeVisible();

  const bodies: string[] = [];
  asha.page.on("response", async (r) => { if (r.request().method() === "POST") bodies.push(await r.text().catch(() => "")); });
  await go(asha.page, chapterHref);
  await expect(asha.page.getByTestId("quiz-choose")).toBeVisible();
  await asha.page.getByRole("checkbox", { name: /Forces: class notes/ }).check();
  await asha.page.getByRole("button", { name: "Start quiz" }).click();
  await expect(asha.page.getByTestId("quiz-taking")).toBeVisible();
  await expect(asha.page.getByTestId("quiz-question")).toHaveCount(3);
  // The model answers never reach the browser while the quiz is open
  await expect(asha.page.getByTestId("quiz-taking")).not.toContainText("Model answer");
  expect(bodies.join("\n")).not.toMatch(/burned in power plants|will finish one day|keyPoints/);

  // Answer in her own words: one right (different words), one half right, one wrong
  for (const qEl of await asha.page.getByTestId("quiz-question").all()) {
    const text = (await qEl.locator("label").textContent())!;
    const answer = /formed/.test(text) ? "dead plants got buried deep in the earth and stayed there for millions of years"
      : /non-renewable/.test(text) ? "because it takes a very long time to be made"
      : "i like cricket a lot";
    await qEl.locator("textarea").fill(answer);
  }
  // Every answer needs a confidence rating before the quiz can be submitted
  await asha.page.getByRole("button", { name: "Submit answers" }).click();
  await expect(asha.page.getByText("Say how sure you are for 3 more answers")).toBeVisible();
  await expect(asha.page.getByTestId("quiz-taking")).toBeVisible();
  for (const qEl of await asha.page.getByTestId("quiz-question").all()) {
    const text = (await qEl.locator("label").textContent())!;
    // Sure of the wrong answer, guessing the half-right one, fairly sure of the right one
    const how = /formed/.test(text) ? "Think so" : /non-renewable/.test(text) ? "Guessing" : "Sure";
    await qEl.getByRole("radio", { name: how }).click();
    await expect(qEl.getByRole("radio", { name: how })).toHaveAttribute("aria-checked", "true");
  }
  await asha.page.getByRole("button", { name: "Submit answers" }).click();
  await expect(asha.page.getByTestId("quiz-result")).toBeVisible();
  await expect(asha.page.getByTestId("quiz-score")).toHaveText("1.5 / 3");
  const reviews = asha.page.getByTestId("quiz-review");
  await expect(reviews.filter({ hasText: /Correct/ })).toHaveCount(1);
  await expect(reviews.filter({ hasText: "Partly correct" })).toHaveCount(1);
  await expect(reviews.filter({ hasText: "Not quite" })).toHaveCount(1);
  await expect(asha.page.getByTestId("quiz-result")).toContainText("Review this"); // 50% on the note
  await expect(asha.page.getByTestId("quiz-result")).toContainText("Model answer");
  // Confidence and result disagree on the wrong answer she was sure of
  await expect(reviews.filter({ hasText: "Not quite" }).getByTestId("quiz-confidence-note")).toContainText("You were sure, but this was wrong");
  await expect(reviews.filter({ hasText: "Not quite" })).toContainText("You said: Sure");

  // --- Her progress feeds the readiness shown on the calendar and Overview; only she sees her attempts
  await go(asha.page, chapterHref);
  await expect(asha.page.getByTestId("attempt-history")).toContainText("1.5 / 3");
  await go(asha.page, `${classUrl}/calendar`);
  await expect(asha.page.getByTestId("upcoming-list")).toContainText("Almost ready · 50%");
  await go(asha.page, classUrl);
  await expect(asha.page.getByTestId("upcoming-card")).toContainText("Almost ready · 50%");

  // --- Mistake Map: her two missed written questions, with what she wrote and the model answer (only she sees it)
  await go(asha.page, `${classUrl}/mistakes`);
  const quizMistakes = asha.page.getByTestId("quiz-mistakes");
  await expect(quizMistakes).toContainText("2 still to fix · 0 fixed");
  await expect(quizMistakes.getByTestId("quiz-mistake")).toHaveCount(2);
  const cricket = quizMistakes.getByTestId("quiz-mistake").filter({ hasText: "i like cricket a lot" });
  await expect(cricket).toContainText("Still to fix");
  await expect(cricket).toContainText("Not quite");
  await expect(cricket).toContainText("Model answer");
  await expect(cricket).toContainText("Wrong while sure");
  await expect(cricket).toContainText("you said “Sure”");
  await expect(cricket.getByRole("link", { name: "Try a quiz on this chapter" })).toHaveAttribute("href", chapterHref);
  // ...the teacher sees which questions were missed, as counts: no names, no answers, no feedback
  await go(t.page, `${classUrl}/mistakes`);
  const classQuiz = t.page.getByTestId("class-quiz");
  await expect(classQuiz.getByTestId("class-quiz-row")).toHaveCount(2);
  await expect(classQuiz.getByTestId("class-quiz-sentence").filter({ hasNotText: "while sure" })).toHaveText("1 of 1 student missed it · 1 still does");
  await expect(classQuiz.getByTestId("class-quiz-sentence").filter({ hasText: "while sure" })).toHaveText("1 of 1 student missed it · 1 still does · 1 missed it while sure");
  await expect(t.page.getByTestId("stat-quizzers")).toContainText("1");
  await expect(t.page.getByTestId("teacher-mistakes")).not.toContainText(/Asha|cricket|takes a very long time/);

  await go(t.page, chapterHref);
  await expect(t.page.getByTestId("attempt-history")).toHaveCount(0);
  await go(t.page, `${classUrl}/calendar`);
  await expect(t.page.getByTestId("upcoming-list")).not.toContainText("Almost ready");

  // --- Outsider can't open the chapter or its quiz
  await go(outsider.page, chapterHref);
  await expect(outsider.page.getByText(/could not be found|not found|404/i).first()).toBeVisible();

  // --- Dashboards: the student sees her next test, progress and quizzes; the teacher sees counts, never names
  await go(asha.page, "/dashboard");
  await expect(asha.page.getByTestId("next-test")).toContainText("Unit 2 test");
  await expect(asha.page.getByTestId("next-test")).toContainText("Almost ready · 50%");
  await expect(asha.page.getByTestId("next-exam")).toContainText("None scheduled");
  await expect(asha.page.getByTestId("progress-card")).toContainText("1 of 1");
  await expect(asha.page.getByTestId("subject-progress")).toContainText("Science");
  await expect(asha.page.getByTestId("dash-recent")).toContainText("1.5 / 3");
  // Charts: her score trend and weekly activity, each with a table view
  await expect(asha.page.getByTestId("score-chart").getByTestId("line-chart")).toBeVisible();
  await asha.page.getByTestId("score-chart").getByText("Show as table").click();
  await expect(asha.page.getByTestId("score-chart").locator("table")).toContainText("50%");
  await expect(asha.page.getByTestId("activity-chart").getByTestId("column-chart")).toBeVisible();
  await expect(asha.page.getByTestId("progress-card").getByTestId("bar-list")).toContainText("Science");
  await go(t.page, "/dashboard");
  await expect(t.page.getByTestId("dash-class")).toContainText("8-C");
  await expect(t.page.getByTestId("dash-class")).toContainText("1 student");
  await expect(t.page.getByTestId("prep-count")).toHaveText("1 of 1 student practised"); // no average with fewer than 3 students
  await expect(t.page.getByTestId("teacher-dashboard")).not.toContainText("Asha");
  await expect(t.page.getByTestId("teacher-activity").getByTestId("column-chart")).toBeVisible();
  // With only one student, no class average is shown anywhere
  await expect(t.page.getByTestId("teacher-average")).toContainText("Appears once at least 3 students");
  await expect(t.page.getByTestId("teacher-chapters")).toContainText("Appears once at least 3 students");
  // Each class also has its own Dashboard tab, showing only that class
  await go(t.page, `${classUrl}/dashboard`);
  await expect(t.page.getByTestId("section-tabs").getByRole("link", { name: "Class dashboard" })).toHaveAttribute("aria-current", "page");
  await expect(t.page.getByTestId("dash-class")).toHaveCount(1);
  await expect(t.page.getByTestId("prep-count")).toHaveText("1 of 1 student practised");
  await go(asha.page, `${classUrl}/dashboard`);
  await expect(asha.page.getByTestId("next-test")).toContainText("Unit 2 test");
  await expect(asha.page.getByTestId("progress-card")).toContainText("1 of 1");
  if (process.env.SHOTS_DIR) {
    await asha.page.screenshot({ path: `${process.env.SHOTS_DIR}/dash-student.png`, fullPage: true });
    await t.page.screenshot({ path: `${process.env.SHOTS_DIR}/dash-teacher.png`, fullPage: true });
    await go(asha.page, classUrl);
    await asha.page.screenshot({ path: `${process.env.SHOTS_DIR}/overview-student.png`, fullPage: true });
    await go(t.page, classUrl);
    await t.page.screenshot({ path: `${process.env.SHOTS_DIR}/overview-teacher.png`, fullPage: true });
  }

  // --- Teacher edits then deletes the date; the student's calendar updates
  await go(t.page, `${classUrl}/calendar`);
  await t.page.getByRole("button", { name: "Edit Unit 2 test" }).click();
  await t.page.getByLabel("Title").nth(1).fill("Unit 2 test (moved)");
  await t.page.getByRole("button", { name: "Save changes" }).click();
  await expect(t.page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(t.page.getByTestId("upcoming-list")).toContainText("Unit 2 test (moved)");
  await t.page.getByRole("button", { name: "Delete Unit 2 test (moved)" }).click();
  await expect(t.page.getByText("Deleted", { exact: true })).toBeVisible();
  await go(asha.page, `${classUrl}/calendar`);
  await expect(asha.page.getByText("Your teacher hasn't added any dates yet.")).toBeVisible();
  await go(asha.page, classUrl);
  await expect(asha.page.getByTestId("urgent-banner")).toHaveCount(0);
});

test("calendar and study pages fit a phone screen", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await signUp(page, "Teacher", "Mr Phone");
  await page.getByLabel("Class name").fill("8-M");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByTestId("join-code")).toBeVisible();
  const classUrl = page.url();
  await page.getByRole("button", { name: "+ Science" }).click();
  await expect(page.getByText(/Science added with \d+ chapters/)).toBeVisible();
  for (const url of [`${classUrl}/notebook`, `${classUrl}/explain`, `${classUrl}/flashcards`, "/settings", `${classUrl}/calendar`, `${classUrl}/study`, `${classUrl}/mistakes`, `${classUrl}/exam-patterns`, `${classUrl}/dashboard`, "/dashboard"]) {
    await go(page, url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
