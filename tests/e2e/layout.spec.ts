import { findSettings, seedPublished, seedStory } from "./db";
import { storageStatePath } from "./env";
import {
  expect,
  accountAction,
  expectSignedOut,
  login,
  logOut,
  openSettings,
  saveTheme,
  sidebarAction,
  test,
} from "./helpers";

test.use({ storageState: storageStatePath("alice") });

// Moved to the settings dialog (D50) and the account menu (D83).
const OLD_ITEMS = [
  "Toggle theme",
  "Language",
  "Change password",
  "Settings",
  "Log out",
];

test("the sidebar names the app and the account, whose menu opens the settings", async ({
  page,
}) => {
  await page.goto("/books");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Story App" })).toBeVisible();
  const account = nav.getByRole("button", { name: "Account menu, Alice" });
  await expect(account).toContainText("Alice");
  for (const name of OLD_ITEMS)
    await expect(nav.getByRole("button", { name, exact: true })).toHaveCount(0);
  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  for (const name of OLD_ITEMS)
    await expect(nav.getByRole("button", { name, exact: true })).toHaveCount(0);
  // Collapsed, the block is the avatar alone.
  await expect(account).not.toContainText("Alice");
  await openSettings(page);

  const dialog = page.getByRole("dialog", { name: "Settings" });
  for (const name of ["Appearance", "Language", "Account"])
    await expect(
      dialog.getByRole("region", { name, exact: true }),
    ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Log out", exact: true }),
  ).toHaveCount(0);
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await nav.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(account).toContainText("Alice");

  await accountAction(page, "My profile");
  await expect(page).toHaveURL("/en/p/Alice");
  await nav.getByRole("link", { name: "Story App" }).click();
  await expect(page).toHaveURL("/en");
});

test("Moderation sits above the account block and Feed is Aktualności in Polish", async ({
  page,
}) => {
  await seedPublished("alice", "Layout", [
    { title: "One", publication: "public", content: "Text" },
  ]);
  await page.goto("/pl/books");
  const nav = page.getByRole("navigation", { name: "Główna" });
  await expect(nav.getByRole("link", { name: "Aktualności" })).toBeVisible();
  const moderation = (await nav
    .getByRole("link", { name: "Moderacja" })
    .boundingBox())!;
  const account = (await nav
    .getByRole("button", { name: "Menu konta, Alice" })
    .boundingBox())!;
  const stats = (await nav
    .getByRole("link", { name: "Statystyki" })
    .boundingBox())!;
  expect(moderation.y).toBeGreaterThan(stats.y);
  expect(moderation.y + moderation.height).toBeLessThanOrEqual(account.y);
});

test("each theme applies at once and survives a reload", async ({ page }) => {
  await page.goto("/books");
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
  await page.goto("/books");
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

test("log out returns to the home page and protects /books again", async ({
  page,
}) => {
  // A session of its own: logging out ends it, and the saved one is for other tests (D75).
  await page.context().clearCookies();
  await login(page, "alice");
  await page.goto("/books");
  await logOut(page);
  await expect(page).toHaveURL("/en");
  await expectSignedOut(page);

  await page.goto("/books");
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
      await page.goto(`/chapters/${id}`);

      await expect(page.locator("header")).toHaveCount(0);
      const title = await page
        .getByRole("textbox", { name: "Title" })
        .boundingBox();
      // Below md the app's top bar (2.5rem) comes first.
      expect(title!.y).toBeLessThan(100);

      await expect(
        page.getByRole("button", { name: "Account", exact: true }),
      ).toHaveCount(0);

      await sidebarAction(page, "Books");
      await expect(page).toHaveURL("/en/books");

      await page.getByRole("link", { name: /^Book \d/ }).click();
      await expect(page).toHaveURL(/\/books\//);
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
  await page.goto("/books");
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
  test.use({ viewport: { width: 375, height: 812 } });

  test("the top bar with the menu and the app name stays clear of the page", async ({
    page,
  }) => {
    const id = await seedStory("alice", { title: "Clear", folder: "Book" });
    await page.goto(`/chapters/${id}`);

    const menu = (await page
      .getByRole("button", { name: "Menu", exact: true })
      .boundingBox())!;
    const name = (await page
      .getByRole("link", { name: "Story App" })
      .boundingBox())!;
    expect(name.x).toBeGreaterThanOrEqual(menu.x + menu.width);
    const back = (await page
      .getByRole("link", { name: /Book/ })
      .boundingBox())!;
    expect(menu.y + menu.height).toBeLessThanOrEqual(back.y);
    // The editor fits the screen under the bar.
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);

    await page.goto("/books");
    const bar = (await page
      .getByRole("button", { name: "Menu", exact: true })
      .boundingBox())!;
    const heading = (await page
      .getByRole("heading", { level: 1 })
      .boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(heading.y);
  });

  test("the drawer closes after choosing a view", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(
      drawer.getByRole("button", { name: "Account menu, Alice" }),
    ).toBeVisible();
    for (const name of OLD_ITEMS)
      await expect(
        drawer.getByRole("button", { name, exact: true }),
      ).toHaveCount(0);
    await page.getByRole("link", { name: "Books" }).click();
    await expect(page).toHaveURL("/en/books");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test("the 404 outside a locale follows the system theme", async ({ page }) => {
  for (const colorScheme of ["dark", "light"] as const) {
    await page.emulateMedia({ colorScheme });
    const response = await page.goto("/missing.txt");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByText("404 | This page could not be found."),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveClass(
      colorScheme === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b)/,
    );
  }
});

test.describe("at 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("pages of one width variant start their heading at the same place (D83)", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Widths", [
      { title: "Wide", publication: "public", content: "Text" },
    ]);
    const heading = async (target: typeof page, path: string) => {
      await target.goto(path);
      return (await target.getByRole("heading", { level: 1 }).boundingBox())!;
    };
    const narrow = [];
    for (const path of ["/feed", "/messages", "/library", "/forums", "/"])
      narrow.push(await heading(page, path));
    const wide = [];
    for (const path of ["/books", "/stats"])
      wide.push(await heading(page, path));
    const admin = await browser.newContext({
      storageState: storageStatePath("admin"),
    });
    wide.push(await heading(await admin.newPage(), "/admin"));
    await admin.close();

    for (const boxes of [narrow, wide])
      for (const box of boxes) {
        expect(box.x).toBeCloseTo(boxes[0].x, 0);
        expect(box.y).toBeCloseTo(boxes[0].y, 0);
      }
    expect(wide[0].x).toBeLessThan(narrow[0].x);
    // Below a breadcrumb the heading of a public book still lines up.
    expect((await heading(page, "/p/Alice/widths")).x).toBeCloseTo(
      narrow[0].x,
      0,
    );
  });
});

test("a signed-in reader keeps the sidebar on a public book and chapter, a guest has none", async ({
  browser,
}) => {
  await seedPublished("alice", "Sidebar", [
    { title: "Night", publication: "public", content: "Text" },
  ]);
  const reader = await browser.newContext({
    storageState: storageStatePath("bob"),
  });
  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  for (const path of ["/p/Alice/sidebar", "/p/Alice/sidebar/night"]) {
    const signedIn = await reader.newPage();
    await signedIn.goto(path);
    await expect(signedIn.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      signedIn
        .getByRole("navigation", { name: "Main" })
        .getByRole("button", { name: "Account menu, Bob" }),
    ).toBeVisible();

    const visitor = await guest.newPage();
    await visitor.goto(path);
    await expect(visitor.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      visitor.getByRole("navigation", { name: "Main" }),
    ).toHaveCount(0);
  }
  await reader.close();
  await guest.close();
});
