import type { Browser, Page } from "@playwright/test";
import { findSettings, seedStory } from "./db";
import { storageStatePath, type UserName } from "./env";
import {
  countActionRequests,
  expect,
  openSettings,
  saveTheme,
  test,
} from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

const seedChapter = () =>
  seedStory("alice", { title: "Chapter", folder: "Book" });

const sideTab = (page: Page, name: string) =>
  page.getByRole("tablist", { name: "Side panel" }).getByRole("tab", { name });
const html = (page: Page) => page.locator("html");

// A fresh browser profile: no localStorage, only the session cookie.
async function newBrowser(
  browser: Browser,
  user: UserName,
  options: { javaScriptEnabled?: boolean; colorScheme?: "light" | "dark" } = {},
) {
  const context = await browser.newContext({
    storageState: storageStatePath(user),
    viewport: { width: 1280, height: 800 },
    ...options,
  });
  return { context, page: await context.newPage() };
}

test("the desktop layout is restored in another browser and rendered by the server", async ({
  page,
  browser,
}) => {
  const id = await seedChapter();
  await page.goto(`/chapters/${id}`);
  await sideTab(page, "Chapters").click();
  await expect
    .poll(async () => (await findSettings("alice"))?.editor?.layout)
    .toMatchObject({ tab: "chapters" });

  const other = await newBrowser(browser, "alice");
  await other.page.goto(`/chapters/${id}`);
  await expect(sideTab(other.page, "Chapters")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await other.context.close();

  // Without JavaScript only the server HTML is shown: no default layout first.
  const noScript = await newBrowser(browser, "alice", {
    javaScriptEnabled: false,
  });
  await noScript.page.goto(`/chapters/${id}`);
  await expect(sideTab(noScript.page, "Chapters")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    noScript.page.getByRole("list", { name: "Chapters" }),
  ).toBeVisible();
  await noScript.context.close();
});

test("another user keeps the default layout and theme", async ({
  page,
  browser,
}) => {
  const id = await seedChapter();
  await page.goto(`/chapters/${id}`);
  await sideTab(page, "Chapters").click();
  await saveTheme(page, "Dark");
  await expect
    .poll(() => findSettings("alice"))
    .toMatchObject({
      appearance: { theme: "dark" },
      editor: { layout: { tab: "chapters" } },
    });

  const bobId = await seedStory("bob", { title: "Bob's", folder: "Bob" });
  const bob = await newBrowser(browser, "bob");
  await bob.page.goto(`/chapters/${bobId}`);
  await expect(sideTab(bob.page, "Notes")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(html(bob.page)).not.toHaveClass(/\bdark\b/);
  await bob.context.close();
});

test("the theme follows the settings in another browser, from the first paint", async ({
  page,
  browser,
}) => {
  await page.goto("/books");
  await saveTheme(page, "Dark");
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.theme)
    .toBe("dark");

  const other = await newBrowser(browser, "alice");
  // The saved theme is in the server HTML, applied by the script in <head>.
  const response = await other.page.request.get("/books");
  expect(await response.text()).toMatch(/<html[^>]*data-theme="dark"/);
  await other.page.goto("/books");
  await expect(html(other.page)).toHaveClass(/\bdark\b/);
  // The browser keeps a copy for pages without a session.
  expect(await other.page.evaluate(() => localStorage.getItem("theme"))).toBe(
    "dark",
  );
  await other.context.close();
});

test("a signed-in user without a saved theme follows the system", async ({
  browser,
}) => {
  const dark = await newBrowser(browser, "alice", { colorScheme: "dark" });
  await dark.page.goto("/books");
  await expect(html(dark.page)).toHaveClass(/\bdark\b/);
  await dark.context.close();

  const light = await newBrowser(browser, "alice", { colorScheme: "light" });
  await light.page.goto("/books");
  await expect(html(light.page)).not.toHaveClass(/\bdark\b/);
  await light.context.close();
});

test("the sign-in page uses the browser's saved theme, otherwise the system one", async ({
  browser,
}) => {
  const visitor = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    colorScheme: "dark",
  });
  const page = await visitor.newPage();
  await page.goto("/");
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await visitor.close();
});

test("the accent color is picked from swatches and kept for the user", async ({
  page,
  browser,
}) => {
  await page.goto("/books");
  const primary = () =>
    page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue("--primary"),
    );
  const sepia = await primary();
  const dialog = await openSettings(page);
  const accents = dialog.getByRole("radiogroup", { name: "Accent color" });
  await expect(accents.getByRole("radio")).toHaveCount(5);
  await expect(accents.getByRole("radio", { name: "Sepia" })).toBeChecked();

  await accents.getByRole("radio", { name: "Navy" }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(html(page)).toHaveAttribute("data-accent", "navy");
  expect(await primary()).not.toBe(sepia);
  await expect
    .poll(async () => (await findSettings("alice"))?.appearance?.accent)
    .toBe("navy");

  // Server HTML of another browser, and the public pages of the signed-in user.
  const other = await newBrowser(browser, "alice");
  await other.page.goto("/");
  await expect(html(other.page)).toHaveAttribute("data-accent", "navy");
  await other.context.close();

  const visitor = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto("/");
  await expect(html(visitorPage)).not.toHaveAttribute("data-accent");
  await visitor.close();
});

test("the dark theme sets a dark color-scheme for native controls", async ({
  browser,
}) => {
  for (const colorScheme of ["dark", "light"] as const) {
    const user = await newBrowser(browser, "alice", { colorScheme });
    await user.page.goto("/books");
    await expect
      .poll(() =>
        user.page.evaluate(
          () => getComputedStyle(document.documentElement).colorScheme,
        ),
      )
      .toBe(colorScheme);
    await user.context.close();
  }
});

test("dragging a separator sends only a few saves", async ({ page }) => {
  const id = await seedChapter();
  await page.goto(`/chapters/${id}`);
  const separator = page.getByRole("separator", {
    name: "Resize notes column",
  });
  const box = (await separator.boundingBox())!;
  const requests = countActionRequests(page);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) {
    await page.mouse.move(box.x - i * 5, box.y + box.height / 2);
  }
  await page.mouse.up();

  await expect
    .poll(async () => (await findSettings("alice"))?.editor?.layout)
    .toMatchObject({ widths: { "story-column": expect.any(Number) } });
  await page.waitForTimeout(1000);
  expect(requests.length).toBeGreaterThanOrEqual(1);
  expect(requests.length).toBeLessThanOrEqual(2);
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the selected view is saved apart from the desktop layout", async ({
    page,
    browser,
  }) => {
    const id = await seedChapter();
    await page.goto(`/chapters/${id}`);
    const tab = (p: Page, name: string) =>
      p.getByRole("tablist", { name: "View" }).getByRole("tab", { name });

    await tab(page, "Chapters").click();
    await expect
      .poll(async () => (await findSettings("alice"))?.editor?.mobileView)
      .toBe("chapters");
    await page.reload();
    await expect(tab(page, "Chapters")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const desktop = await newBrowser(browser, "alice");
    await desktop.page.goto(`/chapters/${id}`);
    await expect(
      desktop.page
        .getByRole("tablist", { name: "Side panel" })
        .getByRole("tab", { name: "Notes" }),
    ).toHaveAttribute("aria-selected", "true");
    await desktop.context.close();
  });
});
