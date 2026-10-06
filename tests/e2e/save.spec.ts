import type { Page } from "@playwright/test";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

function editor(page: Page) {
  return {
    title: page.getByRole("textbox", { name: "Title", exact: true }),
    content: page.getByRole("textbox", { name: "Content", exact: true }),
    notes: page.getByRole("textbox", { name: "Notes", exact: true }),
    status: page.getByRole("status"),
  };
}

test("autosaves about 3 seconds after the last keystroke", async ({ page }) => {
  const id = await seedStory("alice", { title: "Autosave" });
  await page.goto(`/stories/${id}`);
  const { title, content, notes, status } = editor(page);

  await content.fill("Once upon a time");
  await notes.fill("A note");
  await title.fill("Autosave renamed");
  await page.waitForTimeout(2000);
  await expect(status).toHaveText("");
  await expect(status).toHaveText("Saved", { timeout: 5000 });

  await page.reload();
  await expect(title).toHaveValue("Autosave renamed");
  await expect(content).toHaveValue("Once upon a time");
  await expect(notes).toHaveValue("A note");
});

test("Ctrl+S saves immediately", async ({ page }) => {
  const id = await seedStory("alice", { title: "Shortcut" });
  await page.goto(`/stories/${id}`);
  const { content, status } = editor(page);

  await content.fill("Saved right away");
  await page.keyboard.press("Control+s");

  await expect(status).toHaveText("Saved", { timeout: 1500 });
  expect((await findStoryById(id))?.content).toBe("Saved right away");
});

test("shows a conflict when the story was saved in another tab", async ({
  page,
  context,
}) => {
  const id = await seedStory("alice", { title: "Two tabs" });
  const other = await context.newPage();
  await page.goto(`/stories/${id}`);
  await other.goto(`/stories/${id}`);

  await editor(page).content.fill("From the first tab");
  await page.keyboard.press("Control+s");
  await expect(editor(page).status).toHaveText("Saved");

  await editor(other).content.fill("From the second tab");
  await other.keyboard.press("Control+s");

  await expect(editor(other).status).toHaveText(
    /changed in another tab or on another device/,
  );
  expect((await findStoryById(id))?.content).toBe("From the first tab");
});

test("does not save with an empty title and saves once a title is entered", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Untitled soon" });
  await page.goto(`/stories/${id}`);
  const { title, content, status } = editor(page);

  await title.fill("");
  await content.fill("Written without a title");
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(4000);

  await expect(status).toHaveText("");
  expect(await findStoryById(id)).toMatchObject({
    title: "Untitled soon",
    content: "",
  });

  await title.fill("Titled again");
  await expect(status).toHaveText("Saved", { timeout: 5000 });
  expect(await findStoryById(id)).toMatchObject({
    title: "Titled again",
    content: "Written without a title",
  });
});

test("shows an error for a duplicate title", async ({ page }) => {
  await seedStory("alice", { title: "Taken" });
  const id = await seedStory("alice", { title: "Mine" });
  await page.goto(`/stories/${id}`);
  const { title, content, status } = editor(page);

  await content.fill("New content");
  await title.fill("Taken");
  await page.keyboard.press("Control+s");

  await expect(status).toHaveText("A story with this title already exists.");
  expect(await findStoryById(id)).toMatchObject({ title: "Mine", content: "" });
});

test("shows an error when the whole content is cleared and keeps the database intact", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Precious",
    content: "Do not lose me",
  });
  const before = await findStoryById(id);
  await page.goto(`/stories/${id}`);
  const { content, status } = editor(page);

  await content.fill("");
  await page.keyboard.press("Control+s");

  await expect(status).toHaveText(/cannot be cleared/);
  expect(await findStoryById(id)).toEqual(before);
});

test("warns before closing the tab with unsaved changes", async ({ page }) => {
  const id = await seedStory("alice", { title: "Unsaved" });
  await page.goto(`/stories/${id}`);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.accept();
  });

  await editor(page).content.fill("Not saved yet");
  await page.close({ runBeforeUnload: true });

  await expect.poll(() => dialogs).toEqual(["beforeunload"]);
});

test("does not warn before closing the tab when everything is saved", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "All saved" });
  await page.goto(`/stories/${id}`);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.type());
    await dialog.accept();
  });

  await editor(page).content.fill("Saved text");
  await page.keyboard.press("Control+s");
  await expect(editor(page).status).toHaveText("Saved");
  await page.close({ runBeforeUnload: true });

  expect(dialogs).toEqual([]);
});
