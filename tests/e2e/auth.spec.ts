import { exhaustLoginLimit } from "./db";
import { USERS, storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.describe("signed out", () => {
  test("visiting /books opens the sign-in dialog", async ({ page }) => {
    await page.goto("/books");
    await expect(page).toHaveURL(/\/en\?callbackUrl=/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/?auth=login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Invalid nickname or password." }),
    ).toBeVisible();
    await expect(page).toHaveURL("/en?auth=login");
    // Only the password has to be typed again.
    await expect(page.getByLabel("Nickname")).toHaveValue(USERS.alice.nickname);
    await expect(page.getByLabel("Password")).toHaveValue("");
  });

  test("unknown nickname shows the same error", async ({ page }) => {
    await page.goto("/?auth=login");
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
    await page.goto("/?auth=login");
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
    await expect(page).toHaveURL("/en?auth=login");
  });

  test("the form has no email field", async ({ page }) => {
    await page.goto("/?auth=login");
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.getByLabel("Email")).toHaveCount(0);
  });

  test("nickname case does not matter", async ({ page }) => {
    await page.goto("/?auth=login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname.toUpperCase());
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/en");
  });

  test("correct password goes to the home view", async ({ page }) => {
    await page.goto("/?auth=login");
    await page.getByLabel("Nickname").fill(USERS.alice.nickname);
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/en");
  });
});

test.describe("signed in", () => {
  test.use({ storageState: storageStatePath("alice") });

  test("/ shows the search view with the sidebar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/en");
    await expect(
      page.getByRole("heading", { name: "Search stories" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("the removed pages give a 404", async ({ page }) => {
    expect((await page.goto("/login"))!.status()).toBe(404);
    expect((await page.goto("/register"))!.status()).toBe(404);
  });
});
