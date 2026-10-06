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
    await page.getByLabel("Email").fill(USERS.alice.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Invalid email or password." }),
    ).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("correct password redirects to /stories", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.alice.email);
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
