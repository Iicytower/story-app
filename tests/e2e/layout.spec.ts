import { findSettings, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, expectSignedOut, sidebarAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("dark theme survives a reload", async ({ page }) => {
  await page.goto("/stories");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await sidebarAction(page, "Toggle theme");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("dark");

  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await sidebarAction(page, "Toggle theme");
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("light");
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("log out returns to the home page and protects /stories again", async ({
  page,
}) => {
  await page.goto("/stories");
  await sidebarAction(page, "Log out");
  await expect(page).toHaveURL("/");
  await expectSignedOut(page);

  await page.goto("/stories");
  await expect(page).toHaveURL(/\/\?callbackUrl=/);
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

      await expect(page.getByRole("button", { name: "Account" })).toHaveCount(
        0,
      );

      await sidebarAction(page, "Folders");
      await expect(page).toHaveURL("/stories");

      await page.getByRole("link", { name: /Book/ }).click();
      await expect(page).toHaveURL(/\/folders\//);
      await sidebarAction(page, "Toggle theme");
      await expect
        .poll(async () => (await findSettings("alice"))?.appearance?.theme)
        .toBe("dark");
      await sidebarAction(page, "Toggle theme");
      await expect
        .poll(async () => (await findSettings("alice"))?.appearance?.theme)
        .toBe("light");
    });
  });
}

test("Home goes to the default view and a collapsed sidebar stays collapsed", async ({
  page,
}) => {
  await page.goto("/stories");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("/");

  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect
    .poll(
      async () => (await findSettings("alice"))?.appearance?.sidebarCollapsed,
    )
    .toBe(true);
  await page.reload();
  const { width } = (await nav.boundingBox())!;
  expect(width).toBeLessThan(60);
  await nav.getByRole("button", { name: "Expand sidebar" }).click();
  await expect
    .poll(
      async () => (await findSettings("alice"))?.appearance?.sidebarCollapsed,
    )
    .toBe(false);
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu button stays clear of the editor's title row", async ({
    page,
  }) => {
    const id = await seedStory("alice", { title: "Clear", folder: "Book" });
    await page.goto(`/stories/${id}`);

    const menu = await page
      .getByRole("button", { name: "Menu", exact: true })
      .boundingBox();
    const back = await page.getByRole("link", { name: /Book/ }).boundingBox();
    expect(menu!.x + menu!.width).toBeLessThanOrEqual(back!.x);
  });

  test("the drawer closes after choosing a view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: "Folders" }).click();
    await expect(page).toHaveURL("/stories");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
