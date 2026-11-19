import { expect, test, type Page } from "@playwright/test";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const PASSWORD = "correct-horse-1";

async function register(page: Page, role: "Teacher" | "Student", name: string, email: string, add = false) {
  await page.goto(add ? "/register?add=1" : "/register");
  await page.waitForLoadState("networkidle");
  await page.getByRole("radio", { name: role }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  if (role === "Student") {
    await page.getByLabel("Parent or guardian's name").fill("Guardian");
    await page.getByRole("checkbox").check();
  }
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.waitForLoadState("networkidle");
}

async function signIn(page: Page, email: string, add = false) {
  await page.goto(add ? "/login?add=1" : "/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");
}

const menu = (page: Page) => page.getByTestId("account-menu");

test("save several accounts on one browser and switch between them", async ({ page }) => {
  const asha = `asha-${uid()}@example.com`;
  const mehta = `mehta-${uid()}@example.com`;
  await register(page, "Student", "Asha", asha);
  await expect(menu(page)).toContainText("Asha");

  // Add a second account: the first stays signed in
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Add another account" }).click();
  await expect(page.getByTestId("adding-account")).toContainText("You'll stay signed in as Asha");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register\?add=1$/);
  await register(page, "Teacher", "Mr Mehta", mehta, true);
  await expect(menu(page)).toContainText("Mr Mehta");

  // Switch back and forth without a password
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Switch to Asha" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(menu(page)).toContainText("Asha");
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Switch to Mr Mehta" }).click();
  await expect(menu(page)).toContainText("Mr Mehta");

  // Settings lists them too (phones have no sidebar)
  await page.goto("/settings");
  const saved = page.getByTestId("saved-accounts");
  await expect(saved).toContainText("Mr Mehta");
  await expect(saved).toContainText("Asha");
  await saved.getByRole("button", { name: "Switch" }).click();
  await expect(menu(page)).toContainText("Asha");

  // Signing out of one account hands over to the other
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Sign out of Asha" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(menu(page)).toContainText("Mr Mehta");
  await menu(page).click();
  await expect(page.getByRole("menuitem", { name: /Switch to/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Add Asha again, then sign out of everything
  await signIn(page, asha, true);
  await menu(page).click();
  await expect(page.getByRole("menuitem", { name: "Switch to Mr Mehta" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Sign out of all accounts" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("signing out keeps nothing behind on a shared computer", async ({ page }) => {
  const a = `a-${uid()}@example.com`;
  const b = `b-${uid()}@example.com`;
  await register(page, "Student", "First Student", a);
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await register(page, "Student", "Second Student", b);
  await menu(page).click();
  await expect(page.getByRole("menuitem", { name: /Switch to/ })).toHaveCount(0);
  // Signed in, the sign-in page only opens to add an account
  await page.goto("/login");
  await expect(page).toHaveURL(/\/classes$/);
});
