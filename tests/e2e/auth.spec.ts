import { exhaustLoginLimit } from "./db";
import { USERS, storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.describe("signed out", () => {
  test("visiting /stories redirects to /login", async ({ page }) => {
    await page.goto("/stories");
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid nickname or password." }),
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("unknown nickname shows the same error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nickname").fill("nobody");
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid nickname or password." }),
    ).toBeVisible();
  });

  test("over the limit even the right password gets a message", async ({
    page,
  }) => {
    const signIn = async (password: string) => {
      await page.getByLabel("Nickname").fill(USERS.alice.nickname);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
    };
    await page.goto("/login");
    await signIn("wrong-password");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid nickname or password." }),
    ).toBeVisible();

    await exhaustLoginLimit();
    await signIn(USERS.alice.password);

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Too many attempts. Try again in a few minutes." }),
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("the form has no email field", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });

  test("nickname case does not matter", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname.toUpperCase());
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/stories");
  });

  test("correct password redirects to /stories", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname);
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/stories");
  });
});

test.describe("signed in", () => {
  test.use({ storageState: storageStatePath("alice") });

  test("/ redirects to /stories", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/stories");
  });

  test("/login redirects to /stories", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/stories");
  });
});
