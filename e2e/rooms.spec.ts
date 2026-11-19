import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
  if (role === "Teacher") await page.getByLabel("School").fill("Delhi Public School");
  if (role === "Student") {
    await page.getByLabel("Parent or guardian's name").fill("Guardian");
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.waitForLoadState("networkidle");
  return page;
}

async function go(page: Page, url: string) {
  const res = await page.goto(url);
  await page.waitForLoadState("networkidle");
  return res;
}

async function openSection(page: Page, title: string) {
  const section = page.locator("details", { has: page.locator(":scope > summary", { hasText: title }) }).first();
  if ((await section.getAttribute("open")) === null) await section.locator(":scope > summary").click();
}

const sectionNav = (page: Page) => page.getByRole("navigation", { name: "Class sections" });

test("a student studies on their own in My space, without joining a class", async ({ browser }) => {
  const page = await person(browser, "Student", "Riya");

  // Every student has a private space, listed first
  await expect(page.getByRole("heading", { name: "My classes and rooms" })).toBeVisible();
  await page.getByRole("link", { name: /My space/ }).first().click();
  await expect(page).toHaveURL(/\/classes\/c/);
  const space = page.url();
  await expect(page.getByText("Only you can see this space")).toBeVisible();
  await expect(page.getByTestId("join-code")).toHaveCount(0);

  // They set up their own subjects and chapters
  await page.getByLabel("New subject name").fill("Maths");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("New chapters for Maths").fill("Algebra\nGeometry");
  await page.getByRole("button", { name: "Add chapters" }).click();
  await expect(page.getByText("Added 2 chapters")).toBeVisible();

  // A note goes straight into their notebook (nobody reviews it)
  await go(page, `${space}/new`);
  await expect(page.getByText("Your note appears straight away")).toBeVisible();
  await page.getByLabel("Chapter").selectOption({ label: "Algebra" });
  await page.getByLabel("Title").fill("Linear equations");
  await page.getByLabel("Typed notes").fill("An equation like 2x + 3 = 7 has one solution: x = 2. Do the same thing to both sides.");
  await page.getByRole("button", { name: "Add to notebook" }).click();
  await expect(page).toHaveURL(/\/notebook\/c/);
  await expect(page.getByText("Waiting for approval")).toHaveCount(0);
  await expect(page.getByTestId("note-text")).toContainText("2x + 3 = 7");

  // They get the tools to make study material and to practise with it
  await go(page, `${space}/flashcards`);
  await page.getByRole("link", { name: /Algebra/ }).click();
  await expect(page.getByTestId("flashcards-manager")).toBeVisible();
  await go(page, `${space}/study`);
  await page.getByRole("link", { name: /Algebra/ }).click();
  await expect(page.getByTestId("questions-manager")).toBeVisible();
  await expect(page.getByText("Quiz yourself")).toBeVisible();
  await go(page, `${space}/calendar`);
  await expect(page.getByText("Add a test, assignment or exam", { exact: true })).toBeVisible();

  // Homework needs a teacher: not in a personal space
  await expect(sectionNav(page).getByRole("link", { name: "Homework" })).toHaveCount(0);
  expect((await go(page, `${space}/homework`))?.status()).toBe(404);

  // Settings: rename it, but it can't be deleted or left
  await go(page, "/settings");
  const item = page.getByTestId("class-settings-item").filter({ hasText: "Your own space" });
  await item.locator("summary").click();
  await expect(item.getByLabel("Space name")).toHaveValue("My space");
  await expect(item.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  await expect(item.getByRole("button", { name: /Leave/ })).toHaveCount(0);
});

test("a student head runs a room; a supervising teacher gets only the powers the head gives", async ({ browser }) => {
  // The student head starts a room
  const head = await person(browser, "Student", "Kabir");
  await head.getByLabel("Room name").fill("Science study group");
  await head.getByRole("button", { name: "Start room" }).click();
  await expect(head).toHaveURL(/\/classes\/c/);
  const room = head.url();
  await expect(head.getByText("Student head", { exact: true }).first()).toBeVisible();
  const code = (await head.getByTestId("join-code").textContent())!;
  await head.getByRole("button", { name: "+ Science" }).click();
  await expect(head.getByText(/Science added with \d+ chapters/)).toBeVisible();

  // A classmate joins with the code and adds a note, which appears straight away
  const meera = await person(browser, "Student", "Meera");
  await meera.getByLabel("Class code").fill(code);
  await meera.getByRole("button", { name: "Join class or room" }).click();
  await expect(meera).toHaveURL(room);
  await expect(meera.getByText("Room member", { exact: true })).toBeVisible();
  await expect(meera.getByTestId("upload-status")).toContainText("appear straight away");
  await expect(meera.getByTestId("join-code")).toHaveCount(0);
  await expect(meera.getByLabel("New subject name")).toHaveCount(0);
  await openSection(meera, "Members");
  await expect(meera.getByTestId("member-row").filter({ hasText: "Kabir" })).toContainText("Student head");
  await expect(meera.getByRole("button", { name: /Remove/ })).toHaveCount(0);
  await expect(sectionNav(meera).getByRole("link", { name: "Homework" })).toHaveCount(0);

  await go(meera, `${room}/new`);
  await meera.getByLabel("Chapter").selectOption({ index: 1 });
  await meera.getByLabel("Title").fill("Forces summary");
  await meera.getByLabel("Typed notes").fill("A push or a pull is a force. Forces can change speed, direction and shape.");
  await meera.getByRole("button", { name: "Add to notebook" }).click();
  await expect(meera).toHaveURL(/\/notebook\/c/);
  const noteUrl = meera.url();

  const zoya = await person(browser, "Student", "Zoya");
  await zoya.getByLabel("Class code").fill(code);
  await zoya.getByRole("button", { name: "Join class or room" }).click();
  await expect(zoya).toHaveURL(room);
  expect((await go(zoya, noteUrl))?.status()).toBe(200);

  // The head hides it with a reason: the author sees why, other members can't open it
  await go(head, noteUrl);
  await head.getByRole("button", { name: "Hide" }).click();
  await head.getByLabel("Reason for hiding").fill("Please add a diagram");
  await head.getByRole("button", { name: "Hide" }).click();
  await expect(head.getByText("Hidden. The author will see your reason")).toBeVisible();
  await expect(head.getByRole("button", { name: "Show again" })).toBeVisible();
  await go(meera, noteUrl);
  await expect(meera.getByText("Hidden from the room:")).toBeVisible();
  await expect(meera.getByText("Please add a diagram")).toBeVisible();
  expect((await go(zoya, noteUrl))?.status()).toBe(404);
  await head.getByRole("button", { name: "Show again" }).click();
  await expect(head.getByText("Shown again")).toBeVisible();
  expect((await go(zoya, noteUrl))?.status()).toBe(200);

  // The head removes a member
  await go(head, room);
  await openSection(head, "Members");
  await head.getByRole("button", { name: "Remove Zoya" }).click();
  await expect(head.getByText("Zoya removed")).toBeVisible();
  expect((await go(zoya, room))?.status()).toBe(404);

  // A teacher asks to supervise; the head approves
  const rao = await person(browser, "Teacher", "Ms Rao");
  await rao.getByLabel("Class code").fill(code);
  await rao.getByRole("button", { name: "Request to join" }).click();
  await expect(rao.getByText("Request sent. The student head of Science study group needs to approve you.")).toBeVisible();
  await go(head, room);
  await openSection(head, "Supervising teachers");
  await head.getByRole("button", { name: "Approve" }).click();
  await expect(head.getByText("Ms Rao can now look after this room")).toBeVisible();

  // At first a supervisor can only look
  await go(rao, room);
  await expect(rao.getByText("Supervisor", { exact: true }).first()).toBeVisible();
  await expect(rao.getByLabel("New subject name")).toHaveCount(0);
  await expect(rao.getByTestId("join-code")).toHaveCount(0);
  await go(rao, noteUrl);
  await expect(rao.getByRole("button", { name: "Hide" })).toHaveCount(0);
  expect((await go(rao, `${room}/review`))?.status()).toBe(404);

  // The head gives them moderation only
  await go(head, room);
  await openSection(head, "Supervising teachers");
  await head.getByLabel("Ms Rao: Hide notes and delete comments").check();
  await expect(head.getByText(/Ms Rao can now: hide notes/)).toBeVisible();
  await go(rao, noteUrl);
  await expect(rao.getByRole("button", { name: "Hide" })).toBeVisible();
  await go(rao, room);
  await expect(rao.getByLabel("New subject name")).toHaveCount(0);
});
