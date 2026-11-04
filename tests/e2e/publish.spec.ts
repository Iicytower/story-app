import type { Browser, Page } from "@playwright/test";
import { findFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import {
  editorAction,
  expect,
  menuAction,
  publishFromEditor,
  test,
} from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const SECRET_COMMENT = "secret-comment-4c1e";
const SECRET_NOTE = "secret-note-b72a";
const SECRET_FOLDER_NOTE = "secret-folder-note-0d9f";

async function seedBook() {
  await seedStory("alice", {
    title: "One",
    folder: "Book",
    content: `First text <!-- ${SECRET_COMMENT} -->`,
    notes: SECRET_NOTE,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
  });
  await seedStory("alice", {
    title: "Two",
    folder: "Book",
    content: "Second text",
    createdAt: new Date(Date.UTC(2026, 0, 2)),
  });
  const folder = await findFolder("Book");
  await withE2EDb((connection) =>
    connection
      .collection("folders")
      .updateOne({ _id: folder!._id }, { $set: { notes: SECRET_FOLDER_NOTE } }),
  );
  return folder!._id.toString();
}

async function confirm(page: Page, dialog: string, button: string) {
  await page
    .getByRole("alertdialog", { name: dialog })
    .getByRole("button", { name: button, exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

async function anonymous(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  return context.newPage();
}

test("a published folder is readable without logging in until it is unpublished", async ({
  page,
  browser,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await expect(
    page.getByRole("img", { name: "Not public" }).first(),
  ).toBeVisible();
  await menuAction(page, "Actions for Book", "Publish");
  await confirm(page, "Publish folder?", "Publish");
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toHaveValue(/\/p\/Alice\/book$/);
  const url = await link.inputValue();

  const visitor = await anonymous(browser);
  await visitor.goto(url);
  await expect(visitor.getByRole("heading", { name: "Book" })).toBeVisible();
  await expect(visitor.getByText("by Alice")).toBeVisible();
  await visitor.getByRole("link", { name: "1. One" }).click();
  await expect(visitor).toHaveURL(/\/p\/Alice\/book\/one$/);
  await expect(visitor.getByText("First text")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "Two →" })).toBeVisible();
  const html = await visitor.content();
  for (const secret of [SECRET_COMMENT, SECRET_NOTE, SECRET_FOLDER_NOTE]) {
    expect(html).not.toContain(secret);
  }
  const response = await visitor.goto(url);
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();

  await menuAction(page, "Actions for Book", "Unpublish");
  await confirm(page, "Unpublish folder?", "Unpublish");
  await expect(link).toBeHidden();
  expect((await visitor.goto(url))!.status()).toBe(404);
});

test("a chapter published alone keeps the others unpublished, and Publish all reveals them", async ({
  page,
  browser,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for One", "Publish");
  await confirm(page, "Publish chapter?", "Publish");
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toBeVisible();

  const visitor = await anonymous(browser);
  await visitor.goto(await link.inputValue());
  await expect(visitor.getByRole("link", { name: "1. One" })).toBeVisible();
  await expect(visitor.getByRole("link", { name: /Two/ })).toBeHidden();

  const chapters = page.getByRole("list", { name: "Chapters" });
  await expect(
    chapters.getByRole("listitem").filter({ hasText: "One" }).getByRole("img"),
  ).toHaveAccessibleName("Public");
  await menuAction(page, "Actions for Book", "Publish all");
  await confirm(page, "Publish all chapters?", "Publish all");
  await expect(
    chapters.getByRole("listitem").filter({ hasText: "Two" }).getByRole("img"),
  ).toHaveAccessibleName("Public");
  await visitor.reload();
  await expect(visitor.getByRole("link", { name: "2. Two" })).toBeVisible();
});

test("the editor publishes a chapter, and a deleted chapter gives 404", async ({
  page,
  browser,
}) => {
  await seedBook();
  const story = await seedStory("alice", {
    title: "Three",
    folder: "Book",
    content: "Third text",
  });
  await page.goto(`/stories/${story}`);
  await publishFromEditor(page);
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toHaveValue(/\/p\/Alice\/book\/three$/);

  const visitor = await anonymous(browser);
  const url = await link.inputValue();
  await visitor.goto(url);
  await expect(visitor.getByText("Third text")).toBeVisible();

  await editorAction(page, "Delete");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(/\/folders\//);
  expect((await visitor.goto(url))!.status()).toBe(404);
});

test("the old address redirects after a title change", async ({
  page,
  browser,
}) => {
  await seedBook();
  const story = await seedStory("alice", { title: "Three", folder: "Book" });
  await page.goto(`/stories/${story}`);
  await publishFromEditor(page);
  const link = page.getByRole("textbox", { name: "Public link" });
  await expect(link).toHaveValue(/three$/);
  const url = await link.inputValue();
  await page.getByRole("textbox", { name: "Title" }).fill("Renamed");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText(/Saved/);

  const visitor = await anonymous(browser);
  await visitor.goto(url);
  await expect(visitor).toHaveURL(/\/p\/Alice\/book\/renamed$/);
});

test("the old share addresses are gone", async ({ page }) => {
  expect((await page.goto("/s/abc123456789"))!.status()).toBe(404);
});
