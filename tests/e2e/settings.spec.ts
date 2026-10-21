import type { Browser, Page } from "@playwright/test";
import { findSettings, seedStory } from "./db";
import { storageStatePath, type UserName } from "./env";
import { countActionRequests, expect, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

const seedChapter = () =>
  seedStory("alice", { title: "Chapter", folder: "Book" });

const split = (page: Page) => page.getByRole("button", { name: "Split" });
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
  await page.goto(`/stories/${id}`);
  await split(page).click();
  await page.getByRole("button", { name: "Move notes right" }).click();
  await expect
    .poll(async () => (await findSettings("alice"))?.editorLayout)
    .toMatchObject({ split: true, order: ["chapters", "notes"] });

  const other = await newBrowser(browser, "alice");
  await other.page.goto(`/stories/${id}`);
  await expect(split(other.page)).toHaveAttribute("aria-pressed", "true");
  await expect(
    other.page.getByRole("button", { name: "Move chapters left" }),
  ).toBeDisabled();
  await other.context.close();

  // Without JavaScript only the server HTML is shown: no default layout first.
  const noScript = await newBrowser(browser, "alice", {
    javaScriptEnabled: false,
  });
  await noScript.page.goto(`/stories/${id}`);
  await expect(split(noScript.page)).toHaveAttribute("aria-pressed", "true");
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
  await page.goto(`/stories/${id}`);
  await split(page).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect
    .poll(() => findSettings("alice"))
    .toMatchObject({ theme: "dark", editorLayout: { split: true } });

  const bobId = await seedStory("bob", { title: "Bob's", folder: "Bob" });
  const bob = await newBrowser(browser, "bob");
  await bob.page.goto(`/stories/${bobId}`);
  await expect(split(bob.page)).toHaveAttribute("aria-pressed", "false");
  await expect(html(bob.page)).not.toHaveClass(/\bdark\b/);
  await bob.context.close();
});

test("the theme follows the settings in another browser, from the first paint", async ({
  page,
  browser,
}) => {
  await page.goto("/stories");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect
    .poll(async () => (await findSettings("alice"))?.theme)
    .toBe("dark");

  const other = await newBrowser(browser, "alice");
  // The saved theme is in the server HTML, applied by the script in <head>.
  const response = await other.page.request.get("/stories");
  expect(await response.text()).toMatch(/<html[^>]*data-theme="dark"/);
  await other.page.goto("/stories");
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
  await dark.page.goto("/stories");
  await expect(html(dark.page)).toHaveClass(/\bdark\b/);
  await dark.context.close();

  const light = await newBrowser(browser, "alice", { colorScheme: "light" });
  await light.page.goto("/stories");
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
  await page.goto("/login");
  await expect(html(page)).toHaveClass(/\bdark\b/);

  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(html(page)).not.toHaveClass(/\bdark\b/);
  await visitor.close();
});

test("dragging a separator sends only a few saves", async ({ page }) => {
  const id = await seedChapter();
  await page.goto(`/stories/${id}`);
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
    .poll(async () => (await findSettings("alice"))?.editorLayout)
    .toMatchObject({ widths: { "story,notes": expect.any(Object) } });
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
    await page.goto(`/stories/${id}`);
    const tab = (p: Page, name: string) =>
      p.getByRole("tablist", { name: "View" }).getByRole("tab", { name });

    await tab(page, "Chapters").click();
    await expect
      .poll(async () => (await findSettings("alice"))?.mobileView)
      .toBe("chapters");
    await page.reload();
    await expect(tab(page, "Chapters")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const desktop = await newBrowser(browser, "alice");
    await desktop.page.goto(`/stories/${id}`);
    await expect(
      desktop.page
        .getByRole("tablist", { name: "Side panel" })
        .getByRole("tab", { name: "Notes" }),
    ).toHaveAttribute("aria-selected", "true");
    await desktop.context.close();
  });
});
