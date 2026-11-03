import { seedStory } from "./db";
import { USERS, storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.describe("signed out", () => {
  test("a public address without a locale keeps its path and query", async ({
    page,
  }) => {
    await page.goto("/p/Alice/book/chapter?ref=shared");
    await expect(page).toHaveURL("/en/p/Alice/book/chapter?ref=shared");
  });

  test("signing in from a protected page returns there with the locale", async ({
    page,
  }) => {
    await page.goto("/stories?q=dragon");
    await expect(page).toHaveURL(/^[^?]*\/en\?callbackUrl=/);
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(
      "/en/stories?q=dragon",
    );

    await page.getByLabel("Nickname").fill(USERS.alice.nickname);
    await page.getByLabel("Password").fill(USERS.alice.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/en/stories?q=dragon");
  });

  test("an unknown locale gives a 404", async ({ page }) => {
    expect((await page.goto("/xx/p/Alice/book"))!.status()).toBe(404);
    await expect(page).toHaveURL("/xx/p/Alice/book");
  });
});

test.describe("signed in", () => {
  test.use({ storageState: storageStatePath("alice") });

  test("a protected address without a locale keeps its path and query", async ({
    page,
  }) => {
    await page.goto("/stories?q=dragon");
    await expect(page).toHaveURL("/en/stories?q=dragon");
  });

  test("links keep the locale", async ({ page }) => {
    await seedStory("alice", { title: "Linked", folder: "Linked book" });
    await page.goto("/en/stories");
    await page.getByRole("link", { name: "Linked book" }).click();
    await expect(page).toHaveURL(/^[^?]*\/en\/folders\/[0-9a-f]{24}$/);
    await page
      .getByRole("list", { name: "Chapters" })
      .getByRole("link", { name: /^Linked/ })
      .click();
    await expect(page).toHaveURL(/^[^?]*\/en\/stories\/[0-9a-f]{24}$/);
  });

  test("export works without a locale", async ({ page }) => {
    const id = await seedStory("alice", { title: "Exported" });
    const response = await page.request.get(`/stories/${id}/export`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");
  });

  test("an unknown locale gives a 404", async ({ page }) => {
    expect((await page.goto("/xx/stories"))!.status()).toBe(404);
  });

  test("<html lang> follows the locale", async ({ page }) => {
    await page.goto("/en/stories");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
