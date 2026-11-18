import { expect, test, type Browser, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PDF = Buffer.from("%PDF-1.4\n% A worksheet\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
const TXT = Buffer.from("Revision list:\n- Coal\n- Petroleum\n", "utf8");
const FAKE = Buffer.from("MZ\x90\x00 not really a pdf", "latin1");

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

test("notes can carry attachments: checked by content, private to the class, approved, removable", async ({ browser }) => {
  // Teacher, class, subject; Asha may add notes; Ravi is a classmate; Zara is outside the class
  const t = await person(browser, "Teacher", "Mr Das");
  await t.page.getByLabel("Class name").fill("8-A");
  await t.page.getByRole("button", { name: "Create class" }).click();
  await expect(t.page.getByTestId("join-code")).toBeVisible();
  const classUrl = t.page.url();
  const code = (await t.page.getByTestId("join-code").textContent())!;
  await t.page.getByRole("button", { name: "+ Science" }).click();
  await expect(t.page.getByText(/Science added with \d+ chapters/)).toBeVisible();
  const asha = await person(browser, "Student", "Asha");
  await join(asha.page, code);
  const ravi = await person(browser, "Student", "Ravi");
  await join(ravi.page, code);
  const zara = await person(browser, "Student", "Zara");
  await go(t.page, classUrl);
  const row = t.page.getByTestId("roster-row").filter({ hasText: "Asha" });
  await row.getByRole("button", { name: "Confirm form received" }).click();
  await row.getByLabel("Asha can add notes").check();
  await expect(t.page.getByText("Asha can now add notes")).toBeVisible();

  // Asha adds a note from the Notebook tab with attachments only (no photos or typed text needed)
  await go(asha.page, `${classUrl}/notebook`);
  await asha.page.getByRole("link", { name: "Add note" }).first().click();
  await asha.page.waitForLoadState("networkidle");
  await asha.page.getByLabel("Title").fill("Worksheet and revision list");
  await asha.page.getByLabel("Choose files to attach").setInputFiles([
    { name: "Worksheet.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "revision.txt", mimeType: "text/plain", buffer: TXT },
    { name: "virus.pdf", mimeType: "application/pdf", buffer: FAKE },
  ]);
  await expect(asha.page.getByTestId("attachment-list").locator("li")).toHaveCount(3);
  // A program renamed to .pdf is refused by the server, and nothing is saved
  await asha.page.getByRole("button", { name: "Send for approval" }).click();
  await expect(asha.page.getByText(/“virus.pdf” isn't really a PDF file/)).toBeVisible();
  await asha.page.getByRole("button", { name: "Remove virus.pdf" }).click();
  await asha.page.getByRole("button", { name: "Send for approval" }).click();
  await expect(asha.page.getByText("Sent to your teacher for approval")).toBeVisible();
  await expect(asha.page).toHaveURL(/\/notebook\/c/);
  await asha.page.waitForLoadState("networkidle");

  // The author sees and downloads them; downloads arrive intact, as downloads (never shown in the app)
  const files = asha.page.getByTestId("note-attachment");
  await expect(files).toHaveCount(2);
  const pdfHref = (await files.filter({ hasText: "Worksheet.pdf" }).getByRole("link").getAttribute("href"))!;
  const txtHref = (await files.filter({ hasText: "revision.txt" }).getByRole("link").getAttribute("href"))!;
  const res = await asha.page.request.get(pdfHref);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="Worksheet.pdf"/);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(Buffer.from(await res.body()).equals(PDF)).toBe(true);

  // Before approval: classmates can't get them; outsiders and signed-out visitors never can
  expect((await ravi.page.request.get(pdfHref)).status()).toBe(404);
  expect((await zara.page.request.get(pdfHref)).status()).toBe(404);
  const anon = await browser.newContext();
  expect((await anon.request.get(pdfHref)).status()).toBe(401);

  // The teacher sees the attachments in the review queue, with a reminder to check them, and approves
  await go(t.page, `${classUrl}/review`);
  await expect(t.page.getByTestId("review-attachments")).toContainText("2 attachments");
  await expect(t.page.getByTestId("review-attachments")).toContainText("Worksheet.pdf");
  await t.page.getByRole("button", { name: "Approve" }).click();
  await expect(t.page.getByText("Approved. The class can see it now")).toBeVisible();

  // Now classmates can download them (still never outsiders), and the notebook card shows the paperclip
  expect((await ravi.page.request.get(txtHref)).status()).toBe(200);
  expect((await zara.page.request.get(txtHref)).status()).toBe(404);
  await go(ravi.page, `${classUrl}/notebook`);
  await expect(ravi.page.getByTestId("note-card").filter({ hasText: "Worksheet and revision list" }).getByTitle("Attachments")).toContainText("2");

  // Asha removes one attachment while editing: it's gone for everyone
  await go(asha.page, `${classUrl}/notebook`);
  await asha.page.getByTestId("note-card").filter({ hasText: "Worksheet and revision list" }).click();
  await asha.page.waitForLoadState("networkidle");
  await asha.page.getByRole("link", { name: "Edit" }).click();
  await asha.page.waitForLoadState("networkidle");
  await asha.page.getByRole("button", { name: "Remove revision.txt" }).click();
  await asha.page.getByRole("button", { name: "Save and resubmit" }).click();
  await expect(asha.page.getByText("Sent to your teacher for approval")).toBeVisible();
  await asha.page.waitForLoadState("networkidle");
  await expect(asha.page.getByTestId("note-attachment")).toHaveCount(1);
  expect((await asha.page.request.get(txtHref)).status()).toBe(404);

  // Deleting the note deletes its files too
  await asha.page.getByRole("button", { name: /Delete/ }).first().click();
  await expect(asha.page).toHaveURL(/\/notebook$/);
  expect((await asha.page.request.get(pdfHref)).status()).toBe(404);
  await anon.close();
});
