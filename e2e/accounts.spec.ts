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

test("save several accounts on one browser; each chooses whether switching back asks for its password", async ({ page }) => {
  const asha = `asha-${uid()}@example.com`;
  const mehta = `mehta-${uid()}@example.com`;
  await register(page, "Student", "Asha", asha);
  await expect(menu(page)).toContainText("Asha");

  // Asha chooses to be switched back to without a password
  await page.goto("/settings");
  await page.getByLabel("Switch back to Asha without a password").check();
  await page.waitForLoadState("networkidle");

  // Add a second account, which leaves "no password" off
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Add another account" }).click();
  await expect(page.getByTestId("adding-account")).toContainText("Asha stays on this device: switch back from the account menu without a password");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/register\?add=1$/);
  await register(page, "Teacher", "Mr Mehta", mehta, true);
  await expect(menu(page)).toContainText("Mr Mehta");

  // Back to Asha: no password
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Switch to Asha" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(menu(page)).toContainText("Asha");

  // Back to Mr Mehta: he chose to be asked for his password
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Switch to Mr Mehta (asks for password)" }).click();
  await expect(page).toHaveURL(/\/login\?add=1&email=/);
  await expect(page.getByLabel("Email")).toHaveValue(mehta);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(menu(page)).toContainText("Mr Mehta");

  // Settings lists the others too (phones have no sidebar)
  await page.goto("/settings");
  const saved = page.getByTestId("saved-accounts");
  await expect(saved).toContainText("Asha");
  await saved.getByRole("button", { name: "Switch" }).click();
  await expect(menu(page)).toContainText("Asha");

  // Signing out of Asha: Mr Mehta isn't signed in on this device, so nobody is, and the list is cleared
  await menu(page).click();
  await page.getByRole("menuitem", { name: "Sign out of Asha" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page, asha);
  await menu(page).click();
  await expect(page.getByRole("menuitem", { name: /Switch to/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Add Mr Mehta again, this time without a password to switch back; Asha (a plain sign-in) now asks for hers
  await page.goto("/login?add=1");
  await page.getByLabel("Email").fill(mehta);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel(/Switch back to this account without entering its password/).check();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await menu(page).click();
  await expect(page.getByRole("menuitem", { name: "Switch to Asha (asks for password)" })).toBeVisible();
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
