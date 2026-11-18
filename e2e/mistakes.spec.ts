import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const NOTES = "Coal is a fossil fuel. It formed from the remains of ancient plants buried under the earth for millions of years. It is non-renewable, so we must use it carefully.";

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function person(browser: Browser, role: "Teacher" | "Student", name: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
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
  return { ctx, page };
}

async function join(page: Page, code: string) {
  await page.getByLabel("Class code").fill(code);
  await page.getByRole("button", { name: "Join class" }).click();
  await expect(page.getByText(/You joined/)).toBeVisible();
}

// The fake AI's questions: for each stem, the "coal is renewable" trap option and the right answer.
const ANSWERS: Record<string, { trap: string; right: string }> = {
  "Is coal a renewable resource?": { trap: "Yes, new coal forms every year", right: "No, it took millions of years to form" },
  "What was coal formed from?": { trap: "Plants that grew last year", right: "Remains of ancient plants" },
  "Why should we use coal carefully?": { trap: "We can always make more", right: "It will run out one day" },
};

type How = "Sure" | "Think so" | "Guessing";

/** Answers every question in the open practice set, picking the trap or the right answer, then saying how sure. */
async function practise(page: Page, pick: "trap" | "right", how: How = "Sure") {
  await page.getByTestId("mcq-start").first().click();
  await answerAll(page, pick, how);
}

async function answerAll(page: Page, pick: "trap" | "right", how: How = "Sure") {
  for (;;) {
    const q = page.getByTestId("mcq-question");
    await expect(q).toBeVisible();
    const text = (await q.locator("p.font-medium").first().textContent())!.trim();
    const choice = ANSWERS[text][pick];
    await q.getByRole("button", { name: new RegExp(choice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
    // Choosing only selects; saying how sure you are checks the answer
    await expect(page.getByTestId("mcq-feedback")).toHaveCount(0);
    await q.getByTestId("confidence").getByRole("button", { name: how }).click();
    const feedback = page.getByTestId("mcq-feedback");
    await expect(feedback).toBeVisible();
    if (pick === "trap") await expect(feedback).toContainText("Thinks coal is renewable");
    else await expect(feedback).toContainText("Right!");
    const next = page.getByRole("button", { name: /Next question|See results/ });
    const last = (await next.textContent())?.includes("See results");
    await next.click();
    if (last) break;
  }
  await expect(page.getByTestId("mcq-done")).toBeVisible();
}

test("Mistake Map: tagged traps build each student's profile and the class map", async ({ browser }) => {
  // Teacher: class, subject, one approved note
  const t = await person(browser, "Teacher", "Mr Rao");
  await t.page.getByLabel("Class name").fill("8-M");
  await t.page.getByRole("button", { name: "Create class" }).click();
  await expect(t.page.getByTestId("join-code")).toBeVisible();
  const classUrl = t.page.url();
  const code = (await t.page.getByTestId("join-code").textContent())!;
  await t.page.getByRole("button", { name: "+ Science" }).click();
  await expect(t.page.getByText(/Science added with \d+ chapters/)).toBeVisible();
  await go(t.page, `${classUrl}/new`);
  await t.page.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.page.getByLabel("Title").fill("Coal notes");
  await t.page.getByLabel("Typed notes").fill(NOTES);
  await t.page.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.page.getByText("Note added to the class notebook")).toBeVisible();

  // Teacher chooses how many to make, lets students make 3 of their own at a time, then generates (fake AI)
  await go(t.page, `${classUrl}/study`);
  const chapterHref = (await t.page.getByTestId("study-chapter").filter({ hasText: "Exploring Forces" }).getByRole("link").getAttribute("href"))!;
  await go(t.page, chapterHref);
  await t.page.getByLabel("Questions per note").last().selectOption("5");
  await t.page.getByLabel("Students can make new questions").selectOption("3");
  await expect(t.page.getByText("Students get 3 new questions at a time")).toBeVisible();
  await t.page.getByTestId("mcq-generate-all").click();
  await expect(t.page.getByTestId("mcq-drafts")).toContainText("3 questions to check");
  await expect(t.page.getByTestId("mcq-row").first()).toContainText(/Thinks coal (is renewable|comes from rocks)/);

  const students = await Promise.all(["Asha", "Ravi", "Meera"].map((n) => person(browser, "Student", n)));
  for (const s of students) await join(s.page, code);

  // Students don't get the teacher's tools (no making questions for the class, deleting or approve-all)...
  const probe = students[0].page;
  await go(probe, chapterHref);
  await expect(probe.getByTestId("mcq-manager")).toHaveCount(0);
  await expect(probe.getByRole("button", { name: /Approve all|Make questions for|Delete question|Regenerate|Make more questions/ })).toHaveCount(0);
  // ...but in the multiple-choice section they can check drafts and approve one at a time
  const drafts = probe.getByTestId("mcq-practice").getByTestId("drafts-to-check");
  await drafts.locator("summary").click();
  await expect(drafts.getByTestId("student-draft")).toHaveCount(3);
  await drafts.getByTestId("student-draft").first().getByRole("button", { name: /^Approve:/ }).click();
  await expect(probe.getByText("Approved. Thanks for checking!")).toBeVisible();
  await expect(drafts.getByTestId("student-draft")).toHaveCount(2);
  // The Mistake Map tab is only mistakes: no drafts or tools there
  await go(probe, `${classUrl}/mistakes`);
  await expect(probe.getByTestId("teacher-mistakes")).toHaveCount(0);
  await expect(probe.getByTestId("student-draft")).toHaveCount(0);

  // The teacher sees which one a student approved, then approves the rest
  await go(t.page, chapterHref);
  await expect(t.page.getByTestId("mcq-drafts")).toContainText("2 questions to check");
  await expect(t.page.getByTestId("mcq-row").filter({ hasText: "Approved by a student" })).toHaveCount(1);
  await t.page.getByTestId("mcq-drafts").getByRole("button", { name: "Approve all" }).click();
  await expect(t.page.getByTestId("mcq-drafts")).toHaveCount(0);

  // Three students practise: two fall for the "renewable" trap every time, one gets everything right
  for (const [i, s] of students.entries()) {
    await go(s.page, chapterHref);
    await practise(s.page, i < 2 ? "trap" : "right");
  }

  // Students see only their own mistakes: Meera got everything right, so her map is empty even though
  // two classmates fell for the trap (no classmates' mistakes, names, counts or class percentages)
  // (she still sees her own topic map: the chapter is strong, right and sure every time)
  const meera = students[2].page;
  await go(meera, `${classUrl}/mistakes`);
  await expect(meera.getByTestId("mcq-mistakes")).toContainText("No traps yet");
  await expect(meera.getByTestId("trap-row")).toHaveCount(0);
  await expect(meera.getByTestId("trap-node")).toHaveCount(0);
  await expect(meera.getByTestId("topic-node")).toHaveAttribute("data-status", "STRONG");
  await expect(meera.getByTestId("teacher-mistakes")).toHaveCount(0);
  await expect(meera.locator("main")).not.toContainText(/Asha|Ravi|Thinks coal is renewable|of 3 students|students \(/);

  // Asha's Mistake Map: the trap is active, with the sentence from the spec
  const asha = students[0].page;
  await go(asha, `${classUrl}/mistakes`);
  const trap = asha.getByTestId("trap-row").filter({ hasText: "Thinks coal is renewable" });
  await expect(trap).toContainText("Active trap");
  await expect(trap.getByTestId("trap-sentence")).toHaveText("You pick the “Thinks coal is renewable” trap in 3 of 3 Exploring Forces questions.");
  // She was sure every time: a firmly held wrong idea, not a slip
  await expect(trap).toContainText("Fell for it while sure");
  await expect(trap.getByTestId("trap-confidence")).toContainText("You were sure all 3 times you fell for it");
  // Her topic map: the chapter needs work, joined to the trap she fell for; tapping shows the details
  const map = asha.getByTestId("topic-map");
  await expect(map.getByTestId("topic-node")).toHaveAttribute("data-status", "NEEDS_WORK");
  await expect(map.getByTestId("trap-node")).toHaveCount(1);
  await map.getByTestId("trap-node").click();
  await expect(map.getByTestId("topic-details")).toContainText("Thinks coal is renewable");
  await expect(map.getByTestId("topic-details")).toContainText("Shows up in 1 topic");
  await map.getByTestId("topic-details").getByRole("button", { name: /Exploring Forces/ }).click();
  await expect(map.getByTestId("topic-sentence")).toHaveText("0 of 3 right recently · wrong while sure 3 times");
  await expect(asha.getByTestId("calibration")).toContainText("(3 so far)");
  await go(asha, "/dashboard");
  await expect(asha.getByTestId("dash-traps")).toContainText("Thinks coal is renewable");

  // Teacher's class map: 2 of 3 students (67%), no names
  await go(t.page, `${classUrl}/mistakes`);
  await expect(t.page.getByTestId("top-trap")).toHaveText("Most common: “Thinks coal is renewable”. 2 of 3 students (67%) fell for it · 2 still do.");
  const renewable = t.page.getByTestId("class-trap-row").filter({ hasText: "Thinks coal is renewable" });
  await expect(renewable.getByTestId("class-trap-sentence").first()).toContainText("2 of 3 students (67%) fell for it · 2 still do · picked 6 times");
  await renewable.locator("summary").click();
  await expect(renewable.getByTestId("class-trap-sure")).toContainText("2 of the 2 who fell for it were sure they were right");
  // Organised: totals, then mistakes grouped by chapter
  await expect(t.page.getByTestId("stat-practising")).toContainText("3");
  await expect(t.page.getByTestId("stat-active")).toContainText("2");
  await expect(t.page.getByTestId("stat-mistakes")).toContainText("1");
  await expect(t.page.getByTestId("stat-picks")).toContainText("6");
  await expect(t.page.getByTestId("mistake-chapter")).toHaveCount(1);
  await expect(t.page.getByTestId("mistake-chapter")).toContainText("5. Exploring Forces");
  // ...with the wrong answers they actually picked
  await expect(renewable.getByTestId("top-picks")).toContainText("Picked “Yes, new coal forms every year”");
  await expect(renewable.getByTestId("top-picks")).toContainText("Right answer: No, it took millions of years to form");
  // Only mistakes students actually made: nobody fell for "coal comes from rocks", so it isn't listed
  await expect(t.page.getByTestId("class-trap-row").filter({ hasText: "Thinks coal comes from rocks" })).toHaveCount(0);
  await expect(t.page.getByTestId("teacher-mistakes")).not.toContainText(/Asha|Ravi|Meera/);
  if (process.env.SHOTS_DIR) {
    await t.page.screenshot({ path: `${process.env.SHOTS_DIR}/mm-teacher.png`, fullPage: true });
    await asha.screenshot({ path: `${process.env.SHOTS_DIR}/mm-student-dash.png`, fullPage: true });
    await go(asha, `${classUrl}/mistakes`);
    await asha.screenshot({ path: `${process.env.SHOTS_DIR}/mm-student.png`, fullPage: true });
    await go(asha, chapterHref);
    await asha.getByTestId("mcq-start").first().click();
    await asha.getByTestId("mcq-question").getByRole("button").first().click();
    await asha.getByTestId("confidence").getByRole("button", { name: "Think so" }).click();
    await expect(asha.getByTestId("mcq-feedback")).toBeVisible();
    await asha.getByTestId("mcq-practice").screenshot({ path: `${process.env.SHOTS_DIR}/mm-feedback.png` });
  }
  await go(t.page, "/dashboard");
  await expect(t.page.getByTestId("dash-class-traps")).toContainText("“Thinks coal is renewable” (8-M): 2 of 3 students (67%) fell for it · 2 still do");

  // Asha practises the trap but only by guessing: lucky guesses don't fix it, so it stays active
  await go(asha, `${classUrl}/mistakes`);
  await asha.getByRole("button", { name: "Practise the trap: Thinks coal is renewable" }).click();
  await practise(asha, "right", "Guessing");
  await expect(asha.getByTestId("mcq-confidence-summary")).toContainText("Right but not sure: 3");
  await go(asha, `${classUrl}/mistakes`);
  await expect(asha.getByTestId("trap-row").filter({ hasText: "Thinks coal is renewable" })).toContainText("Active trap");
  await expect(asha.getByTestId("trap-confidence")).toContainText("3 times you avoided it by guessing");
  // Her confidence doesn't match her results: sure but wrong, guessing but right
  await expect(asha.getByTestId("calibration-sure")).toContainText("0%");
  await expect(asha.getByTestId("calibration-guess")).toContainText("100%");
  await expect(asha.getByTestId("calibration-advice")).toContainText("You were sure but wrong 3 times");

  // Then she avoids it 3 times in a row while sure: it's fixed, and the class map drops to 1 of 3
  await asha.getByRole("button", { name: "Practise the trap: Thinks coal is renewable" }).click();
  await practise(asha, "right");
  await go(asha, `${classUrl}/mistakes`);
  await expect(asha.getByText("No active traps right now")).toBeVisible();
  await asha.locator("summary", { hasText: /^Fixed/ }).click();
  await expect(asha.getByTestId("trap-row").filter({ hasText: "Thinks coal is renewable" })).toContainText("Fixed");
  await go(t.page, `${classUrl}/mistakes`);
  await expect(asha.getByText("Thinks coal comes from rocks")).toHaveCount(0); // never fell for it, so it isn't her mistake
  await expect(t.page.getByTestId("top-trap")).toHaveText("Most common: “Thinks coal is renewable”. 2 of 3 students (67%) fell for it · 1 still does.");

  // A student makes 3 new questions of their own: they practise them straight away...
  await go(probe, chapterHref);
  await probe.getByTestId("mcq-generate").click();
  await expect(probe.getByTestId("mcq-question")).toBeVisible();
  await answerAll(probe, "right");
  await expect(probe.getByTestId("mcq-done")).toBeVisible();
  // ...and they reach the teacher as drafts marked "Made by a student"
  await go(t.page, chapterHref);
  await expect(t.page.getByTestId("mcq-drafts")).toContainText("3 questions to check");
  await expect(t.page.getByTestId("mcq-row").filter({ hasText: "Made by a student" })).toHaveCount(3);

  // Someone outside the class gets nothing
  const outsider = await person(browser, "Student", "Zara");
  await go(outsider.page, `${classUrl}/mistakes`);
  await expect(outsider.page.getByText(/could not be found|not found|404/i).first()).toBeVisible();
});
