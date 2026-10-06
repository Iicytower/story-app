import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("saves unsaved changes and downloads them as a markdown file", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Zażółć gęślą jaźń",
    content: "Old content",
    notes: "Old notes",
  });
  await page.goto(`/stories/${id}`);

  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Fresh <!-- secret --> text");
  await page
    .getByRole("textbox", { name: "Notes", exact: true })
    .fill("Note: with colon\nand a second line");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .md" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("zazolc-gesla-jazn.md");
  const file = await readFile(await download.path(), "utf8");
  const [, frontmatter, body] = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(
    file,
  )!;
  const saved = await findStoryById(id);
  expect(parse(frontmatter)).toMatchObject({
    title: "Zażółć gęślą jaźń",
    updatedAt: saved?.updatedAt.toISOString(),
    notes: "Note: with colon\nand a second line",
  });
  expect(body).toBe("Fresh <!-- secret --> text");
  expect(saved?.content).toBe("Fresh <!-- secret --> text");
});

test("does not download when saving fails and shows the error", async ({
  page,
}) => {
  await seedStory("alice", { title: "Taken" });
  const id = await seedStory("alice", { title: "Mine" });
  await page.goto(`/stories/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Taken");
  await page.getByRole("button", { name: "Export .md" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "A story with this title already exists.",
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
  await page.goto(`/stories/${id}`);
  await other.goto(`/stories/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await other
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("From the other tab");
  await other.keyboard.press("Control+s");
  await expect(other.getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Export .md" }).click();

  await expect(page.getByRole("status")).toHaveText(
    /changed in another tab or on another device/,
  );
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test("does not download with an empty title", async ({ page }) => {
  const id = await seedStory("alice", { title: "Untitled soon" });
  await page.goto(`/stories/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("");
  await page.getByRole("button", { name: "Export .md" }).click();

  await expect(page.getByRole("status")).toHaveText("Title is required.");
  await page.waitForTimeout(1000);
  expect(downloaded).toBe(false);
});

test("returns 404 for another user's story", async ({ page }) => {
  const id = await seedStory("bob", { title: "Bob's" });
  const response = await page.request.get(`/stories/${id}/export`);
  expect(response.status()).toBe(404);
});
