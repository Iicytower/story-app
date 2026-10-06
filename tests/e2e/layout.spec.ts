import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("dark theme survives a reload", async ({ page }) => {
  await page.goto("/stories");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("log out returns to /login and protects /stories again", async ({
  page,
}) => {
  await page.goto("/stories");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/stories");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});
