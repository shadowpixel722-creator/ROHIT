import { expect, test, type Browser, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import sharp from "sharp";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const sql = (q: string) => execSync(`sqlite3 prisma/e2e.db "${q.replace(/"/g, '\\"')}"`).toString().trim();
const daysAgo = (n: number) => { const d = new Date(Date.now() - n * 86_400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const lessonDay = daysAgo(3);
const longDate = (k: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** A real JPEG "notebook page" carrying EXIF with GPS coordinates and the owner's name. */
async function pagePhoto(label: string, withGps = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="100%" height="100%" fill="#fdfbf3"/>
    ${Array.from({ length: 30 }, (_, i) => `<line x1="40" x2="860" y1="${80 + i * 36}" y2="${80 + i * 36}" stroke="#b9d3ee"/>`).join("")}
    <text x="60" y="70" font-size="40" font-family="sans-serif" fill="#1d3557">${label}</text></svg>`;
  let img = sharp(Buffer.from(svg)).jpeg();
  if (withGps) img = img.withExif({ IFD0: { Artist: "Asha Verma", Model: "Phone X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "28/1 36/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "77/1 12/1 0/1" } });
  return img.toBuffer();
}

/** Navigate and wait until streamed content and hydration have settled. */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Picks the dropdown option whose text matches `re` (e.g. "Science (2 new)" for /^Science/). */
async function pick(page: Page, label: string, re: RegExp) {
  const select = page.getByLabel(label, { exact: true });
  const value = (await select.locator("option", { hasText: re }).first().getAttribute("value"))!;
  await select.selectOption(value);
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

test("students share notebook pages; teacher approves; class discusses", async ({ browser, request }) => {
  // Teacher sets up a class
  const t = await person(browser, "Teacher", "Mr Sharma");
  await t.page.getByLabel("Class name").fill("8-B");
  await t.page.getByRole("button", { name: "Create class" }).click();
  await expect(t.page.getByTestId("join-code")).toBeVisible();
  const classUrl = t.page.url();
  const code = (await t.page.getByTestId("join-code").textContent())!;
  await t.page.getByRole("button", { name: "+ Science" }).click();
  await t.page.getByLabel("New chapters for Science").fill("Crop Production\nCoal and Petroleum");
  await t.page.getByRole("button", { name: "Add chapters" }).click();
  await expect(t.page.getByText("Added 2 chapters")).toBeVisible();

  // Students join. Only the teacher and teacher-approved students can upload.
  const a = await person(browser, "Student", "Asha");
  await join(a.page, code);
  const b = await person(browser, "Student", "Ravi");
  await join(b.page, code);
  await expect(a.page.getByRole("link", { name: "Add note" })).toHaveCount(0);
  await expect(a.page.getByTestId("upload-status")).toContainText("Your teacher and the students they choose add the class notes");

  // Teacher: "Can add notes" needs a confirmed consent form; then approves Asha
  await go(t.page, classUrl);
  const ashaRow = t.page.getByTestId("roster-row").filter({ hasText: "Asha" });
  await expect(ashaRow.getByLabel("Asha can add notes")).toBeDisabled();
  await ashaRow.getByRole("button", { name: "Confirm form received" }).click();
  await expect(ashaRow.getByLabel("Asha can add notes")).toBeEnabled();
  await ashaRow.getByLabel("Asha can add notes").check();
  await expect(t.page.getByText("Asha can now add notes")).toBeVisible();
  await expect(ashaRow.getByLabel("Asha can add notes")).toBeChecked();
  await shot(t.page, "nb-00-uploaders");

  // Asha (approved) uploads two pages + typed notes, from the Notebook tab (adding a note isn't a tab of its own)
  await go(a.page, classUrl);
  await expect(a.page.getByTestId("upload-status")).toContainText("You can add notes");
  await expect(a.page.getByRole("navigation", { name: "Class sections" }).getByRole("link", { name: "Add note" })).toHaveCount(0);
  await a.page.getByRole("navigation", { name: "Class sections" }).getByRole("link", { name: "Notebook" }).click();
  await a.page.getByRole("link", { name: "Add note" }).first().click();
  await expect(a.page).toHaveURL(/\/new/);
  await expect(a.page.getByRole("navigation", { name: "Class sections" }).getByRole("link", { name: "Notebook" })).toHaveAttribute("aria-current", "page");
  await expect(a.page.getByText(/Don't include faces, names/)).toBeVisible();
  await a.page.getByLabel("Chapter").selectOption({ label: "Coal and Petroleum" });
  await a.page.getByLabel("Title").fill("Coal and Petroleum: class notes");
  await a.page.getByLabel("Date of these notes").fill(lessonDay);
  await a.page.getByLabel("Choose notebook photos").setInputFiles([
    { name: "page1.jpg", mimeType: "image/jpeg", buffer: await pagePhoto("Fossil fuels: coal, petroleum", true) },
    { name: "page2.jpg", mimeType: "image/jpeg", buffer: await pagePhoto("CNG and LPG") },
  ]);
  await expect(a.page.getByTestId("picked-page")).toHaveCount(2);
  // Post-scan alignment before upload: rotate + straighten + apply
  await a.page.getByRole("button", { name: "Adjust new page 1" }).click();
  await expect(a.page.getByTestId("adjust-canvas")).toBeVisible();
  await a.page.getByRole("button", { name: "Rotate right" }).click();
  await a.page.getByRole("button", { name: "Rotate left" }).click();
  await a.page.getByLabel("Straighten").focus();
  await a.page.keyboard.press("ArrowRight");
  await a.page.getByRole("button", { name: "Apply" }).click();
  await expect(a.page.getByRole("dialog", { name: "Adjust page" })).toHaveCount(0);
  await expect(a.page.getByTestId("picked-page")).toHaveCount(2);
  // Per-page option: don't convert page 2 (e.g. a drawing)
  await a.page.getByLabel("Convert new page 2 to text").uncheck();
  await a.page.getByLabel("Typed notes").fill("Coke is almost pure carbon. Natural gas is stored as CNG.");
  await a.page.getByRole("button", { name: "Send for approval" }).click();
  await expect(a.page.getByText("Sent to your teacher for approval")).toBeVisible();
  await expect(a.page).toHaveURL(/\/notebook\/c/);
  const noteUrl = a.page.url();
  await expect(a.page.getByText("Waiting for approval")).toBeVisible();
  await expect(a.page.getByTestId("lesson-date")).toHaveText(`Notes from ${longDate(lessonDay)}`);
  await expect(a.page.getByText(/Only you and your teacher/)).toBeVisible();
  const imgSrc = (await a.page.getByRole("button", { name: /Open page 1 of 2/ }).locator("img").getAttribute("src"))!;
  await shot(a.page, "nb-01-pending");

  // Unsupported files are explained
  await go(a.page, `${classUrl}/new`);
  await a.page.getByLabel("Title").fill("Bad upload");
  await a.page.getByLabel("Choose notebook photos").setInputFiles({ name: "IMG_0001.heic", mimeType: "image/heic", buffer: Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(64)]) });
  await a.page.getByRole("button", { name: "Send for approval" }).click();
  await expect(a.page.getByText(/iPhone HEIC photo/)).toBeVisible();

  // Ravi isn't approved: no upload entry points and a clear message
  await go(b.page, `${classUrl}/notebook`);
  await expect(b.page.getByRole("link", { name: "Add note" })).toHaveCount(0);
  await go(b.page, `${classUrl}/new`);
  await expect(b.page.getByText(/hasn't allowed you to add notes/)).toBeVisible();
  await go(b.page, `${classUrl}/mine`);
  await expect(b.page.getByText("You can't add notes yet")).toBeVisible();

  // Ravi can't see the pending note, its URL or its image
  await go(b.page, `${classUrl}/notebook`);
  await expect(b.page.getByText("No approved notes here yet")).toBeVisible();
  await go(b.page, noteUrl);
  await expect(b.page.getByText("Page not found")).toBeVisible();
  expect((await b.page.request.get(imgSrc)).status()).toBe(404);
  expect((await request.get(imgSrc)).status()).toBe(401);

  // If consent is withdrawn, approval is blocked and upload permission is removed
  await go(t.page, classUrl);
  await t.page.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Undo" }).click();
  await expect(t.page.getByTestId("roster-row").filter({ hasText: "Asha" })).toContainText("Consent form pending");
  await expect(t.page.getByLabel("Asha can add notes")).not.toBeChecked();
  await expect(t.page.getByLabel("Asha can add notes")).toBeDisabled();
  await go(t.page, `${classUrl}/review`);
  await expect(t.page.getByTestId("section-tabs").getByRole("link", { name: /Review/ })).toContainText("1");
  await expect(t.page.getByRole("navigation", { name: "Class sections" }).getByRole("link", { name: /Review/ })).toContainText("1");
  const item = t.page.getByTestId("review-item").first();
  await expect(item).toContainText("Consent form not confirmed");
  await shot(t.page, "nb-02-review");
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(t.page.getByText(/Confirm Asha's signed consent form/)).toBeVisible();
  await go(t.page, classUrl);
  await t.page.getByTestId("roster-row").filter({ hasText: "Asha" }).getByRole("button", { name: "Confirm form received" }).click();
  await expect(t.page.getByTestId("roster-row").filter({ hasText: "Asha" })).toContainText("Consent form confirmed");
  await t.page.getByLabel("Asha can add notes").check();
  await expect(t.page.getByText("Asha can now add notes")).toBeVisible();
  await go(t.page, `${classUrl}/review`);
  await t.page.getByTestId("review-item").first().getByRole("button", { name: "Approve" }).click();
  await expect(t.page.getByText("All caught up")).toBeVisible();

  // Approval triggers handwriting reading (fake provider in tests): text appears, contact details are redacted
  await go(t.page, noteUrl);
  // Only page 1 is converted (page 2 was switched off at upload); text is formatted
  await expect(t.page.getByTestId("page-transcript")).toHaveCount(1, { timeout: 20000 });
  const t1 = t.page.getByTestId("page-transcript").first();
  await expect(t1).toContainText("Coal is a fossil fuel");
  await expect(t1.locator("h3")).toHaveText("Fake transcription");
  await expect(t1.locator("li")).toHaveCount(2);
  await expect(t1.locator("strong")).toHaveText("Coal");
  await expect(t1).toContainText("[removed]");
  await expect(t1).not.toContainText("98765");
  await expect(t.page.getByText("Converted by AI. May contain mistakes").first()).toBeVisible();
  await expect(t.page.getByTestId("page-text").nth(1)).toContainText("Not converted to text");
  // Teacher turns conversion on for page 2 → it gets converted too
  await t.page.getByLabel("Convert page 2 to text").check();
  await expect(t.page.getByTestId("page-transcript")).toHaveCount(2, { timeout: 20000 });
  // Teacher rotates page 2 after upload (post-scan alignment fix)
  const p2 = (await t.page.getByTestId("page-text").nth(1).locator("img").getAttribute("src"))!.split("?")[0];
  const before = await sharp(Buffer.from(await (await t.page.request.get(p2)).body())).metadata();
  const gallerySrc = await t.page.getByRole("button", { name: /Open page 2 of 2/ }).locator("img").getAttribute("src");
  await t.page.getByRole("button", { name: "Rotate page 2 right" }).click();
  await expect(async () => {
    const after = await sharp(Buffer.from(await (await t.page.request.get(p2)).body())).metadata();
    expect([after.width, after.height]).toEqual([before.height, before.width]);
  }).toPass();
  // The gallery shows the rotated page too (its image address changes)
  await expect(t.page.getByRole("button", { name: /Open page 2 of 2/ }).locator("img")).not.toHaveAttribute("src", gallerySrc!);

  // View each page full size from the text panel, with zoom
  await t.page.getByRole("button", { name: "View page 2 of 2" }).click();
  const viewer = t.page.getByRole("dialog", { name: "Page 2 of 2" });
  await expect(viewer).toBeVisible();
  // The viewer covers the whole screen and the page fits inside it (regression: it was trapped in the content area)
  const vp = t.page.viewportSize()!;
  const box = (await viewer.boundingBox())!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, vp.width, vp.height]);
  await expect(async () => {
    const img = (await t.page.getByTestId("viewer-image").boundingBox())!;
    expect(img.y + img.height).toBeLessThanOrEqual(vp.height + 1);
    expect(img.x).toBeGreaterThanOrEqual(0);
  }).toPass();
  await viewer.getByRole("button", { name: "Zoom in" }).click();
  await expect(viewer.getByRole("button", { name: "Fit to screen" })).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Open original image" })).toHaveAttribute("href", /\/api\/images\//);
  await t.page.keyboard.press("Escape");
  await expect(t.page.getByRole("dialog")).toHaveCount(0);

  // A page that was never converted (e.g. approved before AI was on) can be converted with one click
  const pageId = p2.split("/").pop()!;
  sql(`update NoteImage set transcript=NULL, transcriptStatus='NONE', transcriptSource=NULL where id='${pageId}'`);
  await t.page.reload();
  await t.page.getByRole("button", { name: "Convert remaining pages (1)" }).click();
  await expect(t.page.getByTestId("page-transcript")).toHaveCount(2, { timeout: 20000 });
  await expect(t.page.getByRole("button", { name: /Convert remaining pages/ })).toHaveCount(0);
  // Teacher corrects page 1; "Read again" keeps teacher-checked text
  await t.page.getByTestId("page-text").first().getByRole("button", { name: "Edit text" }).click();
  await t.page.getByLabel("Text of page 1").fill("Fossil fuels: coal, petroleum (checked)");
  await t.page.getByRole("button", { name: "Save text" }).click();
  await expect(t.page.getByText("Checked by teacher")).toBeVisible();
  await t.page.getByRole("button", { name: "Convert all again" }).click();
  await expect(t.page.getByText("Converting the pages again")).toBeVisible();
  await expect(t.page.getByTestId("page-transcript").first()).toHaveText("Fossil fuels: coal, petroleum (checked)");
  await shot(t.page, "nb-06-page-text");
  await go(t.page, "/settings"); // class settings, including AI usage, are on the Settings page
  await expect(t.page.getByTestId("ai-usage").first()).toContainText("AI handwriting reading is on");

  // The served image has no EXIF/GPS and is re-encoded
  const served = await a.page.request.get(imgSrc);
  expect(served.status()).toBe(200);
  const meta = await sharp(Buffer.from(await served.body())).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();

  // Student B now sees it, filters by subject/chapter, opens the gallery, searches and comments
  await go(b.page, `${classUrl}/notebook`);
  await pick(b.page, "Subject", /^Science/);
  await expect(b.page).toHaveURL(/subject=/);
  await pick(b.page, "Chapter", /^Coal and Petroleum/);
  await expect(b.page).toHaveURL(/chapter=/);
  await expect(b.page.getByTestId("note-card")).toHaveCount(1);
  await pick(b.page, "Chapter", /^Crop Production/);
  await expect(b.page.getByText("No approved notes here yet")).toBeVisible();
  await go(b.page, `${classUrl}/notebook?q=CNG`);
  await expect(b.page.getByTestId("note-card")).toHaveCount(1);
  await go(b.page, `${classUrl}/notebook?q=petroleum (checked)`); // only in the page text
  await expect(b.page.getByTestId("note-card")).toHaveCount(1);
  // New text for a chapter: the chapter chip shows it, and the combined chapter page marks it New once
  await go(b.page, `${classUrl}/notebook`);
  await pick(b.page, "Subject", /^Science/);
  await expect(b.page).toHaveURL(/subject=/);
  await expect(b.page.getByLabel("Chapter", { exact: true }).locator("option", { hasText: /Coal and Petroleum \(1 new\)/ })).toHaveCount(1);
  await pick(b.page, "Chapter", /^Coal and Petroleum/);
  await expect(b.page).toHaveURL(/chapter=/);
  await b.page.getByRole("link", { name: /Read the whole chapter/ }).click();
  await expect(b.page.getByTestId("chapter-note")).toHaveCount(1);
  await expect(b.page.getByTestId("chapter-note")).toContainText("New");
  await expect(b.page.getByTestId("chapter-note")).toContainText("Fossil fuels: coal, petroleum (checked)");
  await expect(b.page.getByTestId("chapter-page")).toHaveCount(2);
  await b.page.getByRole("button", { name: "View page 1 of 2" }).click();
  await expect(b.page.getByRole("dialog", { name: "Page 1 of 2" })).toBeVisible();
  await b.page.keyboard.press("Escape");
  // Chapter notebook: contents, search within the chapter, clean print
  await expect(b.page.getByTestId("chapter-toc").getByRole("link")).toHaveCount(1);
  await b.page.getByLabel("Search in this chapter").fill("fossil");
  await expect(b.page.getByTestId("search-count")).toHaveText(/^1 of [1-9]\d*$/);
  await b.page.getByLabel("Search in this chapter").fill("zzzz");
  await expect(b.page.getByTestId("search-count")).toHaveText("No matches");
  expect(await b.page.evaluate(() => (CSS as unknown as { highlights: Map<string, unknown> }).highlights.has("chapter-search-current"))).toBe(false);
  await b.page.emulateMedia({ media: "print" });
  await expect(b.page.getByTestId("chapter-toolbar")).toBeHidden();
  await expect(b.page.getByRole("navigation", { name: "Class sections" })).toBeHidden();
  await expect(b.page.locator(".chapter-photo").first()).toBeHidden();
  await expect(b.page.getByTestId("chapter-page").first()).toBeVisible();
  await b.page.emulateMedia({ media: "screen" });
  await expect(b.page.getByText("1 new since your last visit")).toBeVisible();
  await shot(b.page, "nb-07-chapter");
  await b.page.reload();
  await expect(b.page.getByText("1 new since your last visit")).toHaveCount(0);
  await expect(b.page.getByTestId("chapter-note")).not.toContainText("New");
  await go(b.page, `${classUrl}/notebook?q=CNG`);
  await b.page.getByTestId("note-card").click();
  await b.page.getByRole("button", { name: /Open page 1 of 2/ }).click();
  await expect(b.page.getByRole("dialog")).toContainText("Page 1 of 2");
  await b.page.getByRole("button", { name: "Next page" }).click();
  await expect(b.page.getByRole("dialog")).toContainText("Page 2 of 2");
  await b.page.keyboard.press("Escape");
  await expect(b.page.getByRole("dialog")).toHaveCount(0);
  await expect(b.page.getByTestId("note-text")).toContainText("Coke is almost pure carbon");
  await expect(b.page.getByRole("button", { name: "Edit" })).toHaveCount(0); // not the author
  await b.page.getByLabel("Write a comment").fill("What is the full form of CNG?");
  await b.page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(b.page.getByTestId("comment")).toContainText("What is the full form of CNG?");
  await shot(b.page, "nb-03-note");

  // Teacher replies, then moderates B's comment
  await go(t.page, noteUrl);
  await t.page.getByLabel("Write a comment").fill("Compressed Natural Gas.");
  await t.page.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(t.page.getByTestId("comment")).toHaveCount(2);
  await t.page.getByTestId("comment").filter({ hasText: "full form" }).getByRole("button", { name: "Delete comment" }).click();
  await expect(t.page.getByTestId("comment")).toHaveCount(1);

  // Author edits the approved note (removes a page) → back to review → hidden from B
  await go(a.page, noteUrl);
  await a.page.getByRole("link", { name: "Edit" }).click();
  await expect(a.page.getByText(/sends it back to your teacher/)).toBeVisible();
  await a.page.getByRole("button", { name: "Remove page 2" }).click();
  await a.page.getByRole("button", { name: "Save and resubmit" }).click();
  await expect(a.page.getByText("Sent to your teacher for approval")).toBeVisible();
  await expect(a.page.getByRole("button", { name: /Open page 1 of 1/ })).toBeVisible();
  await go(b.page, noteUrl);
  await expect(b.page.getByText("Page not found")).toBeVisible();

  // Teacher asks for changes → student sees the reason in My notes
  await go(t.page, `${classUrl}/review`);
  await t.page.getByTestId("review-item").first().getByRole("button", { name: "Reject" }).click();
  await t.page.getByLabel("Reason for rejecting").fill("Please add the page about CNG back");
  await t.page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(t.page.getByText("All caught up")).toBeVisible();
  await go(a.page, `${classUrl}/mine`);
  await expect(a.page.getByTestId("note-card")).toContainText("Changes requested");
  await expect(a.page.getByTestId("note-card")).toContainText("Please add the page about CNG back");
  await shot(a.page, "nb-04-mine");

  // Teacher's own typed note is published immediately
  await go(t.page, `${classUrl}/new`);
  await t.page.getByLabel("Chapter").selectOption({ label: "5. Exploring Forces" });
  await t.page.getByLabel("Title").fill("Chapter summary");
  await t.page.getByLabel("Typed notes").fill("Exhaustible resources: coal, petroleum, natural gas.");
  await t.page.getByRole("button", { name: "Add to notebook" }).click();
  await expect(t.page.getByText("Note added to the class notebook")).toBeVisible();
  await go(b.page, `${classUrl}/notebook`);
  await expect(b.page.getByTestId("note-card").filter({ hasText: "Chapter summary" })).toBeVisible();
  await expect(b.page.getByTestId("note-card").filter({ hasText: "Chapter summary" })).toContainText("5. Exploring Forces");

  // Teacher withdraws Asha's permission: no Add note / Edit, but she can still delete her own note
  await go(t.page, classUrl);
  await t.page.getByLabel("Asha can add notes").uncheck();
  await expect(t.page.getByText("Asha can no longer add notes")).toBeVisible();
  await go(a.page, `${classUrl}/notebook`);
  await expect(a.page.getByRole("link", { name: "Add note" })).toHaveCount(0);

  // Author deletes their note; its image is gone too
  await go(a.page, noteUrl);
  await expect(a.page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await a.page.getByRole("button", { name: "Delete" }).click();
  await expect(a.page).toHaveURL(/\/notebook$/);
  expect((await t.page.request.get(imgSrc)).status()).toBe(404);

  await t.ctx.close();
  await a.ctx.close();
  await b.ctx.close();
});

test("mobile note form fits and offers the camera", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signUp(page, "Teacher", "Ms Rao");
  await page.getByLabel("Class name").fill("8-A");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByTestId("join-code")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const add = page.getByRole("button", { name: "+ Science" });
  await add.evaluate((e) => e.scrollIntoView({ block: "center" })); // keep clear of the fixed bottom tab bar
  await add.click();
  await expect(page.getByLabel("Subject name", { exact: true })).toHaveValue("Science");
  const base = page.url();
  for (const path of [`${base}/new`, `${base}/notebook`, `${base}/review`]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `overflow on ${path}`).toBeLessThanOrEqual(0);
  }
  await page.goto(`${base}/new`);
  await expect(page.getByRole("button", { name: "Take photo" })).toBeVisible();
  await shot(page, "nb-05-mobile-new");
  await ctx.close();
});
