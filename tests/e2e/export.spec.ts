import type { Page } from "@playwright/test";
import { findFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { editorAction, expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

async function submitExport(page: Page) {
  await editorAction(page, "Export as…");
  await page.getByRole("button", { name: "Export", exact: true }).click();
}

test("does not download when saving fails and shows the error", async ({
  page,
}) => {
  await seedStory("alice", { title: "Taken" });
  const id = await seedStory("alice", { title: "Mine" });
  await page.goto(`/chapters/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Taken");
  await submitExport(page);

  await expect(page.getByRole("status")).toHaveText(
    "A chapter with this title already exists in this book.",
  );
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test("does not download when the story was saved in another tab", async ({
  page,
  context,
}) => {
  const id = await seedStory("alice", { title: "Two tabs" });
  const other = await context.newPage();
  await page.goto(`/chapters/${id}`);
  await other.goto(`/chapters/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await other
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("From the other tab");
  await other.keyboard.press("Control+s");
  await expect(other.getByRole("status")).toHaveText("Saved");
  await submitExport(page);

  await expect(page.getByRole("status")).toHaveText(
    /changed in another tab or on another device/,
  );
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test("does not download with an empty title", async ({ page }) => {
  const id = await seedStory("alice", { title: "Untitled soon" });
  await page.goto(`/chapters/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("");
  await submitExport(page);

  await expect(page.getByRole("status")).toHaveText("Title is required.");
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test("returns 404 for another user's story", async ({ page }) => {
  const id = await seedStory("bob", { title: "Bob's" });
  const response = await page.request.get(`/chapters/${id}/export`);
  expect(response.status()).toBe(404);
});

test("folder export returns 404 for another user's folder", async ({
  page,
}) => {
  await seedStory("bob", { title: "Bob's", folder: "Bob's book" });
  const folder = await findFolder("Bob's book");
  const response = await page.request.get(`/books/${folder!._id}/export`);
  expect(response.status()).toBe(404);
});
