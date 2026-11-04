import { findSettings, seedStory } from "./db";
import { storageStatePath } from "./env";
import {
  expect,
  expectSignedOut,
  openSettings,
  saveTheme,
  sidebarAction,
  test,
} from "./helpers";

test.use({ storageState: storageStatePath("alice") });

// Moved to the settings dialog (D50).
const OLD_ITEMS = ["Toggle theme", "Language", "Change password", "Log out"];

test("the sidebar keeps the views and opens the settings", async ({ page }) => {
  await page.goto("/stories");
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const name of OLD_ITEMS)
    await expect(nav.getByRole("button", { name })).toHaveCount(0);
  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  for (const name of OLD_ITEMS)
    await expect(nav.getByRole("button", { name })).toHaveCount(0);
  await nav.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  for (const name of ["Appearance", "Language", "Account"])
    await expect(dialog.getByRole("region", { name })).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await nav.getByRole("button", { name: "Expand sidebar" }).click();
});

test("each theme applies at once and survives a reload", async ({ page }) => {
  await page.goto("/stories");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/\bdark\b/);

  await saveTheme(page, "Dark");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("dark");
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);

  await saveTheme(page, "Light");
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("light");
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "dark" });
  await saveTheme(page, "System");
  await expect(html).toHaveClass(/\bdark\b/);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBeNull();
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
  const dialog = await openSettings(page);
  await expect(dialog.getByLabel("Theme")).toHaveValue("system");
});

test("Save is enabled only after a change, and Cancel discards it", async ({
  page,
}) => {
  await page.goto("/stories");
  const dialog = await openSettings(page);
  const save = dialog.getByRole("button", { name: "Save" });
  const theme = dialog.getByLabel("Theme");
  await expect(save).toBeDisabled();
  await expect(theme).toHaveValue("system");
  await theme.selectOption({ label: "Dark" });
  await expect(save).toBeEnabled();
  await theme.selectOption({ label: "System" });
  await expect(save).toBeDisabled();

  await theme.selectOption({ label: "Dark" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);

  await openSettings(page);
  await expect(theme).toHaveValue("system");
  await theme.selectOption({ label: "Dark" });
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await openSettings(page);
  await expect(theme).toHaveValue("system");
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme ?? null)
    .toBeNull();
});

test("log out returns to the home page and protects /stories again", async ({
  page,
}) => {
  await page.goto("/stories");
  const dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/en");
  await expectSignedOut(page);

  await page.goto("/stories");
  await expect(page).toHaveURL(/\/en\?callbackUrl=/);
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
      await expect(page).toHaveURL("/en/stories");

      await page.getByRole("link", { name: /Book/ }).click();
      await expect(page).toHaveURL(/\/folders\//);
      await saveTheme(page, "Dark");
      await expect
        .poll(async () => (await findSettings("alice"))?.appearance?.theme)
        .toBe("dark");
      await saveTheme(page, "Light");
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
  await expect(page).toHaveURL("/en");

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
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(
      drawer.getByRole("button", { name: "Settings" }),
    ).toBeVisible();
    for (const name of OLD_ITEMS)
      await expect(drawer.getByRole("button", { name })).toHaveCount(0);
    await page.getByRole("link", { name: "Folders" }).click();
    await expect(page).toHaveURL("/en/stories");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
