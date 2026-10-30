import type { Browser, Page } from "@playwright/test";
import { findFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const SECRET_COMMENT = "secret-comment-4c1e";
const SECRET_NOTE = "secret-note-b72a";
const SECRET_FOLDER_NOTE = "secret-folder-note-0d9f";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Newest first: "Two" is chapter 1, "One" chapter 2.
async function seedBook() {
  await seedStory("alice", {
    title: "One",
    folder: "Book",
    content: `First text <!-- ${SECRET_COMMENT} -->`,
    notes: SECRET_NOTE,
    createdAt: day(1),
  });
  await seedStory("alice", {
    title: "Two",
    folder: "Book",
    content: "Second text",
    createdAt: day(2),
  });
  const folder = await findFolder("Book");
  await withE2EDb((connection) =>
    connection
      .collection("folders")
      .updateOne({ _id: folder!._id }, { $set: { notes: SECRET_FOLDER_NOTE } }),
  );
  return folder!._id.toString();
}

async function shareFolder(page: Page, id: string) {
  await page.goto(`/folders/${id}`);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const link = page.getByRole("textbox", { name: "Share link" });
  await expect(link).toHaveValue(/\/s\/f\/[\w-]{16,}$/);
  return link.inputValue();
}

async function openAnonymously(browser: Browser, url: string) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  const response = await page.goto(url);
  return { context, page, response: response! };
}

test("export returns 404 for another user's folder", async ({ page }) => {
  await seedStory("bob", { title: "Bob's", folder: "Bob's book" });
  const folder = await findFolder("Bob's book");
  const response = await page.request.get(
    `/folders/${folder!._id}/export`,
  );
  expect(response.status()).toBe(404);
});

test("shared folder shows contents and chapters without notes or comments to a visitor", async ({
  page,
  browser,
}) => {
  const id = await seedBook();
  const url = await shareFolder(page, id);

  const visitor = await openAnonymously(browser, url);
  expect(visitor.response.status()).toBe(200);
  await expect(
    visitor.page.getByRole("heading", { name: "Book" }),
  ).toBeVisible();
  const contents = visitor.page.getByRole("list", { name: "Chapters" });
  await expect(contents.getByRole("listitem")).toHaveText(["1. Two", "2. One"]);
  expect(visitor.response.headers()["x-robots-tag"]).toContain("noindex");
  expect(await visitor.response.text()).not.toContain(SECRET_FOLDER_NOTE);

  await contents.getByRole("link", { name: "2. One" }).click();
  await expect(visitor.page).toHaveURL(`${url}/2`);
  await expect(
    visitor.page.getByRole("heading", { name: "One" }),
  ).toBeVisible();
  await expect(visitor.page.getByText("First text")).toBeVisible();
  await expect(
    visitor.page.locator('head meta[name="robots"]'),
  ).toHaveAttribute("content", /noindex/);
  const chapter = await visitor.page.request.get(`${url}/2`);
  const html = await chapter.text();
  expect(html).not.toContain(SECRET_COMMENT);
  expect(html).not.toContain(SECRET_NOTE);
  expect(html).not.toContain(SECRET_FOLDER_NOTE);
  expect(chapter.headers()["x-robots-tag"]).toContain("noindex");

  await visitor.page.getByRole("link", { name: "← Two" }).click();
  await expect(visitor.page).toHaveURL(`${url}/1`);
  await expect(visitor.page.getByText("Second text")).toBeVisible();
  await visitor.context.close();
});

test("the folder link returns 404 after Stop sharing and after the folder is deleted", async ({
  page,
  browser,
}) => {
  const id = await seedBook();
  const url = await shareFolder(page, id);

  await page.getByRole("button", { name: "Stop sharing" }).click();
  await expect(page.getByRole("textbox", { name: "Share link" })).toBeHidden();
  const stopped = await openAnonymously(browser, url);
  expect(stopped.response.status()).toBe(404);
  await stopped.context.close();

  const shared = await shareFolder(page, id);
  await page.getByRole("button", { name: "Delete Two" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete story?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("list", { name: "Chapters" }).getByRole("listitem"),
  ).toHaveCount(1);
  const visitor = await openAnonymously(browser, shared);
  await expect(
    visitor.page.getByRole("list", { name: "Chapters" }).getByRole("listitem"),
  ).toHaveText(["1. One"]);
  await visitor.context.close();

  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("alertdialog", { name: "Delete folder?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL("/stories");
  const deleted = await openAnonymously(browser, shared);
  expect(deleted.response.status()).toBe(404);
  await deleted.context.close();
});
