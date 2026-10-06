import type { Browser, Page } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const SECRET_COMMENT = "secret-comment-7f3a";
const SECRET_NOTE = "secret-note-91bd";

async function shareFromEditor(page: Page, id: string) {
  await page.goto(`/stories/${id}`);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const link = page.getByRole("textbox", { name: "Share link" });
  await expect(link).toHaveValue(/\/s\/[\w-]{16,}$/);
  return link.inputValue();
}

// A fresh context without the stored session, like a recipient of the link.
async function openAnonymously(browser: Browser, url: string) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  const response = await page.goto(url);
  return { context, page, response: response! };
}

test("shared link shows the story without comments or notes to a visitor without a session", async ({
  page,
  browser,
}) => {
  const id = await seedStory("alice", {
    title: "Public tale",
    content: `Visible start <!-- ${SECRET_COMMENT} -->\n\n**Bold end**`,
    notes: SECRET_NOTE,
  });
  const url = await shareFromEditor(page, id);

  const visitor = await openAnonymously(browser, url);

  expect(visitor.response.status()).toBe(200);
  await expect(visitor.page).toHaveURL(url);
  await expect(
    visitor.page.getByRole("heading", { name: "Public tale" }),
  ).toBeVisible();
  await expect(visitor.page.getByText("Visible start")).toBeVisible();
  await expect(visitor.page.locator("strong")).toHaveText("Bold end");
  const html = await visitor.response.text();
  expect(html).not.toContain(SECRET_COMMENT);
  expect(html).not.toContain(SECRET_NOTE);
  expect(visitor.response.headers()["x-robots-tag"]).toContain("noindex");
  await expect(
    visitor.page.locator('head meta[name="robots"]'),
  ).toHaveAttribute("content", /noindex/);
  await visitor.context.close();
});

test("the link survives a reload and returns 404 after Stop sharing", async ({
  page,
  browser,
}) => {
  const id = await seedStory("alice", { title: "Short-lived" });
  const url = await shareFromEditor(page, id);
  const before = await openAnonymously(browser, url);
  expect(before.response.status()).toBe(200);
  await before.context.close();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Share link" })).toHaveValue(
    url,
  );
  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("textbox", { name: "Share link" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeVisible();

  const after = await openAnonymously(browser, url);
  expect(after.response.status()).toBe(404);
  await expect(after.page.getByText("Short-lived")).toHaveCount(0);
  await after.context.close();
});

test("the link returns 404 after the story is deleted", async ({
  page,
  browser,
}) => {
  const id = await seedStory("alice", { title: "Doomed" });
  const url = await shareFromEditor(page, id);
  const before = await openAnonymously(browser, url);
  expect(before.response.status()).toBe(200);
  await before.context.close();

  await page.getByRole("button", { name: "Delete Doomed" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete story?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL("/stories");

  const after = await openAnonymously(browser, url);
  expect(after.response.status()).toBe(404);
  await after.context.close();
});

test("an unknown token returns 404", async ({ page }) => {
  const response = await page.goto("/s/unknown-token-1234567");
  expect(response?.status()).toBe(404);
});
