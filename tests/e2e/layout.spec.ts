import { findSettings, seedStory } from "./db";
import { storageStatePath } from "./env";
import { accountAction, expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("dark theme survives a reload", async ({ page }) => {
  await page.goto("/stories");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await accountAction(page, "Toggle theme");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("dark");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await accountAction(page, "Toggle theme");
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("light");
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("log out returns to /login and protects /stories again", async ({
  page,
}) => {
  await page.goto("/stories");
  await accountAction(page, "Log out");
  await expect(page).toHaveURL("/login");

  await page.goto("/stories");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
});

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["a narrow screen", { width: 390, height: 844 }],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test("the editor starts at the top and the menu reaches every action", async ({
      page,
    }) => {
      const id = await seedStory("alice", { title: "Menu", folder: "Book" });
      await page.goto(`/stories/${id}`);

      await expect(page.locator("header")).toHaveCount(0);
      const title = await page
        .getByRole("textbox", { name: "Title" })
        .boundingBox();
      expect(title!.y).toBeLessThan(60);

      const account = await page
        .getByRole("button", { name: "Account" })
        .boundingBox();
      const toolbarButton = await page
        .getByRole("button", { name: "Delete" })
        .boundingBox();
      expect(toolbarButton!.x + toolbarButton!.width).toBeLessThanOrEqual(
        account!.x,
      );

      const home = page.getByRole("link", { name: "Home" });
      const homeBox = await home.boundingBox();
      const titleBox = await page
        .getByRole("link", { name: /Book/ })
        .boundingBox();
      expect(homeBox!.x + homeBox!.width).toBeLessThanOrEqual(titleBox!.x);
      await home.click();
      await expect(page).toHaveURL("/stories");

      await page.goto(`/stories/${id}`);
      await accountAction(page, "Stories");
      await expect(page).toHaveURL("/stories");

      await page.getByRole("link", { name: /Book/ }).click();
      await expect(page).toHaveURL(/\/folders\//);
      await accountAction(page, "Toggle theme");
      await expect
        .poll(async () => (await findSettings("alice"))?.appearance?.theme)
        .toBe("dark");
      await accountAction(page, "Toggle theme");
      await expect
        .poll(async () => (await findSettings("alice"))?.appearance?.theme)
        .toBe("light");
    });
  });
}
