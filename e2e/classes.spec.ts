import { expect, test, type Browser, type Page } from "@playwright/test";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

async function signUp(page: Page, role: "Teacher" | "Student", name: string, email: string) {
  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: role }).click();
  await expect(page.getByRole("radio", { name: role })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-1");
  if (role === "Teacher") await page.getByLabel("School").fill("Delhi Public School");
  if (role === "Student") {
    await page.getByLabel("Parent or guardian's name").fill("Mrs Verma");
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.waitForLoadState("networkidle"); // let React hydrate before typing into controlled inputs
}

/** Opens a collapsible section (a <details> whose summary contains `title`) if it is closed. */
async function openSection(page: Page, title: string) {
  const section = page.locator("details", { has: page.locator(":scope > summary", { hasText: title }) }).first();
  if ((await section.getAttribute("open")) === null) await section.locator(":scope > summary").click();
}

async function newPage(browser: Browser, opts = {}) {
  const ctx = await browser.newContext(opts);
  return { ctx, page: await ctx.newPage() };
}

test("teacher creates a class; student joins; permissions are enforced", async ({ browser }) => {
  const t = await newPage(browser);
  const teacher = t.page;
  teacher.on("dialog", (d) => d.accept());
  await teacher.goto("/");
  await shot(teacher, "n-00-landing");
  await signUp(teacher, "Teacher", "Mr Sharma", `teacher-${uid()}@example.com`);
  await expect(teacher.getByRole("heading", { name: "Your classes" })).toBeVisible();
  await expect(teacher.getByText("No classes yet")).toBeVisible();

  // Create class
  await teacher.getByLabel("Class name").fill("8-B Science");
  await teacher.getByRole("button", { name: "Create class" }).click();
  await expect(teacher).toHaveURL(/\/classes\/c/);
  const classUrl = teacher.url();
  await expect(teacher.getByRole("heading", { name: "8-B Science" })).toBeVisible();
  await expect(teacher.locator("span", { hasText: /^Class 8$/ })).toBeVisible();
  const code = (await teacher.getByTestId("join-code").textContent())!;
  expect(code).toMatch(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);

  // Subjects and chapters
  await teacher.getByRole("button", { name: "+ Science" }).click();
  await expect(teacher.getByLabel("Subject name", { exact: true })).toHaveValue("Science");
  // Class 8 Science comes with the NCERT chapter list (Curiosity, Reprint 2026-27)
  await expect(teacher.getByText("Science added with 13 chapters from the NCERT textbook")).toBeVisible();
  await expect(teacher.getByTestId("index-source")).toContainText("Curiosity (hecu1)");
  // Every chapter is editable, NCERT ones included (they carry an "NCERT" tag)
  const names = teacher.locator('input[aria-label="Chapter name"]');
  await expect(teacher.getByTestId("ncert-chapter")).toHaveCount(13);
  await expect(names).toHaveCount(13);
  await expect(names.nth(4)).toHaveValue("5. Exploring Forces");
  // rename an NCERT chapter (it is then the teacher's own, so it loses the tag)
  await names.nth(4).fill("5. Forces (our notes)");
  await names.nth(4).press("Enter");
  await expect(teacher.getByTestId("ncert-chapter")).toHaveCount(12);
  await expect(teacher.locator('input[aria-label="Chapter name"][value="5. Forces (our notes)"]')).toHaveCount(1);
  // a duplicate name in the same subject is refused
  await names.nth(5).fill("5. Forces (our notes)");
  await names.nth(5).press("Enter");
  await expect(teacher.getByText(/already has a chapter called/)).toBeVisible();
  // delete an NCERT chapter (confirm dialog accepted), then bring the NCERT ones back
  const firstName = await names.nth(0).inputValue();
  await teacher.getByRole("button", { name: `Delete chapter ${firstName}` }).click();
  await expect(teacher.getByText(`Deleted “${firstName}”`)).toBeVisible();
  await expect(names).toHaveCount(12);
  await teacher.getByRole("button", { name: "Add missing NCERT chapters" }).click();
  await expect(teacher.getByText("Added 2 NCERT chapters")).toBeVisible(); // the deleted one and the renamed one's original
  await expect(names).toHaveCount(14);
  // reorder any chapter
  const top = await names.nth(0).inputValue();
  await teacher.getByRole("button", { name: `Move ${top} down` }).click();
  await expect(names.nth(1)).toHaveValue(top);
  // Teachers can add their own chapters
  await teacher.getByLabel("New chapters for Science").fill("Chapter 1: Crop Production and Management\nChapter 2: Microorganisms: Friend and Foe\n\nChapter 3: Coal and Petroleum");
  await teacher.getByRole("button", { name: "Add chapters" }).click();
  await expect(teacher.getByText("Added 3 chapters")).toBeVisible();
  await expect(names).toHaveCount(17);
  await expect(names.nth(14)).toHaveValue("Crop Production and Management");
  await teacher.getByRole("button", { name: "Move Coal and Petroleum up" }).click();
  await expect(names.nth(15)).toHaveValue("Coal and Petroleum");
  // Hindi has no bundled index: added empty, with a clear note
  await teacher.getByRole("button", { name: "+ Hindi" }).click();
  await expect(teacher.getByLabel("Subject name", { exact: true })).toHaveCount(2);
  await expect(teacher.getByText(/Hindi and Sanskrit chapters are added by you/)).toBeVisible();
  await teacher.getByRole("button", { name: "+ Mathematics" }).click();
  await expect(teacher.getByLabel("Subject name", { exact: true })).toHaveCount(3);
  // duplicate subject rejected
  await teacher.getByLabel("New subject name").fill("science");
  await teacher.getByRole("button", { name: "Add", exact: true }).click();
  await expect(teacher.getByText(/already has/)).toBeVisible();
  await shot(teacher, "n-01-teacher-class");

  // Student signs up (consent required) and joins
  const s = await newPage(browser);
  const student = s.page;
  student.on("dialog", (d) => d.accept());
  await student.goto("/register");
  await student.getByLabel("Your name").fill("Asha");
  await student.getByLabel("Email").fill(`student-${uid()}@example.com`);
  await student.getByLabel("Password", { exact: true }).fill("correct-horse-1");
  await student.getByLabel("Parent or guardian's name").fill("Mrs Verma");
  await student.getByRole("checkbox").evaluate((el: HTMLInputElement) => el.removeAttribute("required"));
  await student.getByRole("button", { name: "Create account" }).click();
  await expect(student.getByText(/must agree/)).toBeVisible(); // enforced on the server too
  const studentEmail = `student-${uid()}@example.com`;
  await signUp(student, "Student", "Asha", studentEmail);
  await expect(student.getByRole("heading", { name: "My classes" })).toBeVisible();
  await expect(student.getByText("Create a class")).toHaveCount(0);

  await student.getByLabel("Class code").fill("ZZZ-ZZZ");
  await student.getByRole("button", { name: "Join class" }).click();
  await expect(student.getByText(/doesn't match any class/)).toBeVisible();
  await student.getByLabel("Class code").fill(code.toLowerCase());
  await student.getByRole("button", { name: "Join class" }).click();
  await expect(student).toHaveURL(classUrl);
  await expect(student.getByText("You joined 8-B Science")).toBeVisible();
  await openSection(student, "Science");
  await expect(student.getByText("Coal and Petroleum")).toBeVisible();
  await expect(student.getByText(/hasn't confirmed your parent\/guardian consent form/)).toBeVisible();
  // Read-only for students: no editors, no join code, no roster
  await expect(student.getByLabel("New subject name")).toHaveCount(0);
  await expect(student.getByTestId("join-code")).toHaveCount(0);
  await expect(student.getByTestId("roster-row")).toHaveCount(0);
  await expect(student.getByText("Mr Sharma · Delhi Public School · 1 student")).toBeVisible();
  await shot(student, "n-02-student-class");

  // Teacher sees the student and confirms consent
  await teacher.reload();
  const row = teacher.getByTestId("roster-row").filter({ hasText: "Asha" });
  await expect(row).toContainText("Guardian: Mrs Verma");
  await expect(row).toContainText("Consent form pending");
  await row.getByRole("button", { name: "Confirm form received" }).click();
  await expect(row).toContainText("Consent form confirmed");
  await student.reload();
  await expect(student.getByText(/hasn't confirmed your parent\/guardian consent form/)).toHaveCount(0);

  // Closing joining blocks new students
  await openSection(teacher, "Invite students");
  await teacher.getByRole("button", { name: "Close joining" }).click();
  await expect(teacher.getByText("Joining is closed.")).toBeVisible();
  const s2 = await newPage(browser);
  await signUp(s2.page, "Student", "Ravi", `student2-${uid()}@example.com`);
  await s2.page.getByLabel("Class code").fill(code);
  await s2.page.getByRole("button", { name: "Join class" }).click();
  await expect(s2.page.getByText(/isn't accepting new members/)).toBeVisible();
  // ...and a stranger can't open the class by URL
  await s2.page.goto(classUrl);
  await expect(s2.page.getByText("Page not found")).toBeVisible();

  // New code: old code stops working
  await teacher.getByRole("button", { name: "Open joining" }).click();
  await expect(teacher.getByText("Students can join with this code.")).toBeVisible();
  await teacher.getByRole("button", { name: "New code" }).click();
  await expect(teacher.getByTestId("join-code")).not.toHaveText(code);
  await s2.page.goto("/classes");
  await s2.page.getByLabel("Class code").fill(code);
  await s2.page.getByRole("button", { name: "Join class" }).click();
  await expect(s2.page.getByText(/doesn't match any class/)).toBeVisible();

  // Teacher removes the student → student loses access
  await teacher.getByRole("button", { name: "Remove Asha" }).click();
  await expect(teacher.getByText("Asha removed")).toBeVisible();
  await student.goto(classUrl);
  await expect(student.getByText("Page not found")).toBeVisible();
  await student.goto("/classes");
  await expect(student.getByText("You haven't joined a class yet")).toBeVisible();

  // Changing the class switches NCERT chapter lists (confirm dialog is accepted); teacher's own chapters stay
  // Class settings live on the Settings page (left sidebar), one section per class; the Overview links there
  await teacher.reload();
  await teacher.waitForLoadState("networkidle");
  await teacher.getByTestId("class-settings-link").click();
  await expect(teacher).toHaveURL(/\/settings#class-/);
  await teacher.waitForLoadState("networkidle");
  const classSettings = teacher.getByTestId("class-settings-item").filter({ hasText: "8-B Science" });
  await expect(classSettings).toHaveAttribute("open", "");
  await classSettings.getByLabel("Class", { exact: true }).selectOption("10");
  await classSettings.getByRole("button", { name: "Save", exact: true }).click();
  await expect(teacher.getByText(/Chapters switched: \d+ added, \d+ unused removed/)).toBeVisible();
  await teacher.goto(classUrl);
  await teacher.waitForLoadState("networkidle");
  await openSection(teacher, "Subjects and chapters");
  await teacher.getByRole("button", { name: "Expand Science" }).click();
  await expect(teacher.locator('[data-testid="ncert-chapter"] input').first()).toHaveValue("1. Chemical Reactions and Equations");
  await expect(teacher.locator('input[aria-label="Chapter name"][value="5. Exploring Forces"]')).toHaveCount(0);
  await expect(teacher.locator('input[aria-label="Chapter name"][value="5. Forces (our notes)"]')).toHaveCount(1); // the teacher's renamed chapter stays
  await expect(teacher.locator('input[aria-label="Chapter name"][value="Coal and Petroleum"]')).toHaveCount(1);

  // Teacher deletes the class from Settings (typed confirmation)
  await teacher.goto("/settings");
  await teacher.waitForLoadState("networkidle");
  await openSection(teacher, "8-B Science");
  await teacher.getByRole("button", { name: "Delete class" }).click();
  await teacher.getByLabel(/to delete this class/).fill("8-B Science");
  await teacher.getByRole("button", { name: "Delete permanently" }).click();
  await expect(teacher).toHaveURL(/\/classes$/);
  await expect(teacher.getByText("No classes yet")).toBeVisible();

  await t.ctx.close();
  await s.ctx.close();
  await s2.ctx.close();
});

test("the sidebar takes you back to where you were in each section", async ({ browser }) => {
  const t = await newPage(browser);
  const page = t.page;
  await signUp(page, "Teacher", "Ms Nav", `teacher-${uid()}@example.com`);
  await page.getByLabel("Class name").fill("8-N");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page).toHaveURL(/\/classes\/c/);
  const classUrl = page.url();
  await page.getByRole("navigation", { name: "Class sections" }).getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await page.waitForLoadState("networkidle");

  const sidebar = page.getByRole("complementary");
  await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.waitForLoadState("networkidle");
  await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Classes" }).click();
  await expect(page).toHaveURL(`${classUrl}/calendar`); // back where she was, not the class list
  await page.waitForLoadState("networkidle");
  await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
  await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Classes" }).click();
  await expect(page).toHaveURL(`${classUrl}/calendar`);
  await page.waitForLoadState("networkidle");
  // Clicking the section you're already in goes to its start page
  await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Classes" }).click();
  await expect(page).toHaveURL(/\/classes$/);

  // Settings → Account: "Change password" is a dropdown, closed until opened, and folds away after a change
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const pw = page.getByTestId("change-password");
  await expect(pw).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Current password")).toBeHidden();
  await pw.locator("summary").click();
  await page.getByLabel("Current password").fill("correct-horse-1");
  await page.getByLabel("New password").fill("correct-horse-2");
  await pw.getByRole("button", { name: "Change" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();
  await expect(pw).not.toHaveAttribute("open", "");
  await t.ctx.close();
});

test("mobile: no horizontal overflow, dark mode works", async ({ browser }) => {
  const { ctx, page } = await newPage(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
  await signUp(page, "Teacher", "Ms Rao", `mobile-${uid()}@example.com`);
  await page.getByLabel("Class name").fill("8-A");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByTestId("join-code")).toBeVisible();
  // On phones the fixed bottom tab bar can cover controls near the screen edge; scroll them to the middle first.
  const btn = page.getByRole("button", { name: "+ Social Science" });
  await btn.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await btn.click();
  await expect(page.getByLabel("Subject name", { exact: true })).toHaveValue("Social Science");
  await expect(page.locator("html")).toHaveClass(/dark/);
  for (const path of [page.url(), "/classes", "/settings"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await shot(page, "n-03-mobile-settings");
  await ctx.close();
});

test("an outdated page (app restarted/updated) shows a clear Refresh message", async ({ browser }) => {
  const { ctx, page } = await newPage(browser);
  await signUp(page, "Teacher", "Mr Rao", `stale-${uid()}@example.com`);
  // Simulate the server no longer knowing this page's action (what happens after a restart/deploy).
  await page.route("**/classes", async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.headers()["next-action"]) {
      await route.fulfill({ status: 404, headers: { "x-nextjs-action-not-found": "1", "content-type": "text/plain" }, body: "Server action not found." });
    } else await route.continue();
  });
  await page.getByLabel("Class name").fill("9-C");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText(/The app was updated\. Refresh the page/)).toBeVisible();
  await expect(page.getByText(/Couldn't reach the server/)).toHaveCount(0);
  await page.unroute("**/classes");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Class name")).toBeVisible();
  await ctx.close();
});

test("teachers can request to join an existing class; the creator approves", async ({ browser }) => {
  const o = await newPage(browser);
  const owner = o.page;
  owner.on("dialog", (d) => d.accept());
  await signUp(owner, "Teacher", "Mr Sharma", `owner-${uid()}@example.com`);
  await owner.getByLabel("Class name").fill("8-C");
  await owner.getByRole("button", { name: "Create class" }).click();
  await expect(owner.getByTestId("join-code")).toBeVisible();
  const classUrl = owner.url();
  const code = (await owner.getByTestId("join-code").textContent())!;

  // Second teacher (same school) requests to join → pending, no access yet
  const c = await newPage(browser);
  const co = c.page;
  co.on("dialog", (d) => d.accept());
  await signUp(co, "Teacher", "Ms Rao", `co-${uid()}@example.com`);
  await co.getByRole("heading", { name: "Join an existing class or a student room" }).scrollIntoViewIfNeeded();
  await co.getByLabel("Class code").fill(code);
  await co.getByRole("button", { name: "Request to join" }).click();
  await expect(co.getByText(/Request sent\. The teacher of 8-C needs to approve you/)).toBeVisible();
  await expect(co.getByTestId("pending-requests")).toContainText("8-C");
  await co.goto(classUrl);
  await expect(co.getByText("Page not found")).toBeVisible();

  // Owner sees the request with a "Same school" hint and approves it
  await owner.reload();
  const req = owner.getByTestId("teacher-row").filter({ hasText: "Ms Rao" });
  await expect(req).toContainText("Wants to join");
  await expect(req).toContainText("Same school");
  await req.getByRole("button", { name: "Approve" }).click();
  await expect(owner.getByText("Ms Rao can now co-teach this class")).toBeVisible();
  await expect(req).toContainText("Co-teacher");

  // Co-teacher: full teaching access, but can't delete the class or manage teachers
  await co.goto("/classes");
  await expect(co.getByRole("link", { name: /8-C/ })).toContainText("Co-teacher");
  await co.goto(classUrl);
  await co.waitForLoadState("networkidle");
  await expect(co.getByText("You teach this class")).toBeVisible();
  await expect(co.getByTestId("join-code")).toBeVisible();
  await expect(co.getByRole("button", { name: "Delete class" })).toHaveCount(0);
  await co.goto("/settings");
  await co.waitForLoadState("networkidle");
  await openSection(co, "8-C");
  await expect(co.getByTestId("class-settings-item").filter({ hasText: "8-C" })).toContainText("You co-teach this class");
  await expect(co.getByRole("button", { name: "Delete class" })).toHaveCount(0);
  await expect(co.getByRole("button", { name: "Leave class" })).toBeVisible();
  await co.goto(classUrl);
  await co.waitForLoadState("networkidle");
  await expect(co.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  const add = co.getByRole("button", { name: "+ Science" });
  await add.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await add.click();
  await expect(co.getByLabel("Subject name", { exact: true })).toHaveValue("Science");

  // Students still join directly and are counted as students only
  const s = await newPage(browser);
  await signUp(s.page, "Student", "Asha", `st-${uid()}@example.com`);
  await s.page.getByLabel("Class code").fill(code);
  await s.page.getByRole("button", { name: "Join class" }).click();
  await expect(s.page).toHaveURL(classUrl);
  await expect(s.page.getByText(/· 1 student$/)).toBeVisible();
  await expect(s.page.getByTestId("teacher-row")).toHaveCount(0);

  // Owner removes the co-teacher → access is gone
  await owner.reload();
  await openSection(owner, "Teachers");
  await owner.getByRole("button", { name: "Remove Ms Rao" }).click();
  await expect(owner.getByText("Ms Rao removed")).toBeVisible();
  await co.goto(classUrl);
  await expect(co.getByText("Page not found")).toBeVisible();
  await o.ctx.close(); await c.ctx.close(); await s.ctx.close();
});

test("class pages are grouped into sections: sidebar, sub-tabs and the phone's bottom bar", async ({ browser }) => {
  const { ctx, page } = await newPage(browser);
  await signUp(page, "Teacher", "Ms Rao", `nav-${uid()}@example.com`);
  await page.getByLabel("Class name").fill("8-T");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByTestId("join-code")).toBeVisible();
  const classUrl = page.url();
  // Desktop: the sidebar lists the class's sections and pages; the switcher names the class
  const classNav = page.getByRole("navigation", { name: "Class sections" });
  await expect(page.getByTestId("class-switcher")).toContainText("8-T");
  for (const section of ["Learn", "Practise", "Plan", "Teach"]) await expect(classNav).toContainText(section);
  await classNav.getByRole("link", { name: "Flashcards" }).click();
  await expect(page).toHaveURL(/\/flashcards$/);
  // The section's pages appear as sub-tabs above the page
  const tabs = page.getByTestId("section-tabs");
  await expect(tabs.getByRole("link")).toHaveText(["Study", "Flashcards", "Mistake Map", "Boss Battles"]);
  await expect(tabs.getByRole("link", { name: "Flashcards" })).toHaveAttribute("aria-current", "page");
  await tabs.getByRole("link", { name: "Mistake Map" }).click();
  await expect(page).toHaveURL(/\/mistakes$/);
  await ctx.close();

  // Phone: the bottom bar shows the class's sections and remembers the last page in each
  const { ctx: phone, page: p2 } = await newPage(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await signUp(p2, "Teacher", "Mr Paul", `navm-${uid()}@example.com`);
  await p2.getByLabel("Class name").fill("9-P");
  await p2.getByRole("button", { name: "Create class" }).click();
  await expect(p2.getByTestId("join-code")).toBeVisible();
  const bar = p2.getByRole("navigation", { name: "Main" });
  await expect(bar.getByRole("link")).toHaveText(["Home", "Learn", "Practise", "Plan", "Teach"]);
  await bar.getByRole("link", { name: "Plan" }).click();
  await expect(p2).toHaveURL(/\/calendar$/);
  await p2.getByTestId("section-tabs").getByRole("link", { name: "Exam patterns" }).click();
  await expect(p2).toHaveURL(/\/exam-patterns$/);
  await bar.getByRole("link", { name: "Learn" }).click();
  await expect(p2).toHaveURL(/\/classes\/[^/]+$/);
  await bar.getByRole("link", { name: "Plan" }).click();
  await expect(p2).toHaveURL(/\/exam-patterns$/); // back where they were in Plan
  expect(await p2.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (SHOTS) await p2.screenshot({ path: `${SHOTS}/nav-phone.png` });
  await phone.close();
  expect(classUrl).toContain("/classes/");
});
