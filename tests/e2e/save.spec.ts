import type { Page } from "@playwright/test";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import {
  countActionRequests,
  expect,
  hideTab,
  runAutosaveDelay,
  test,
} from "./helpers";

test.use({ storageState: storageStatePath("alice") });

function editor(page: Page) {
  return {
    title: page.getByRole("textbox", { name: "Title", exact: true }),
    content: page.getByRole("textbox", { name: "Content", exact: true }),
    notes: page.getByRole("textbox", { name: "Notes", exact: true }),
    status: page.getByRole("status"),
  };
}

test("autosaves 20 seconds after the last keystroke", async ({ page }) => {
  const id = await seedStory("alice", { title: "Autosave" });
  await page.clock.install();
  await page.goto(`/stories/${id}`);
  const { title, content, notes, status } = editor(page);

  await content.fill("Once upon a time");
  await notes.fill("A note");
  await title.fill("Autosave renamed");
  await runAutosaveDelay(page, 19_000);
  await expect(status).toHaveText("");
  expect((await findStoryById(id))?.title).toBe("Autosave");
  await runAutosaveDelay(page, 1000);
  await expect(status).toHaveText("Saved");

  await page.reload();
  await expect(title).toHaveValue("Autosave renamed");
  await expect(content).toHaveText("Once upon a time");
  await expect(notes).toHaveText("A note");
});

test("typing with pauses shorter than 20 seconds does not save", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Pauses" });
  await page.clock.install();
  await page.goto(`/stories/${id}`);
  const { content, status } = editor(page);
  const requests = countActionRequests(page);

  await content.click();
  for (const word of ["One", " two", " three", " four"]) {
    await page.keyboard.type(word);
    await runAutosaveDelay(page, 10_000);
  }
  await expect(status).toHaveText("");
  expect(requests).toEqual([]);

  await runAutosaveDelay(page, 10_000);
  await expect(status).toHaveText("Saved");
  expect((await findStoryById(id))?.content).toBe("One two three four");
});

test("hiding the tab saves at once, and only when something changed", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Hidden" });
  await page.clock.install();
  await page.goto(`/stories/${id}`);
  const { content, status } = editor(page);
  const requests = countActionRequests(page);

  await hideTab(page);
  await expect(content).toBeVisible();
  expect(requests).toEqual([]);

  await content.fill("Saved on leaving");
  await hideTab(page);
  await expect(status).toHaveText("Saved");
  expect((await findStoryById(id))?.content).toBe("Saved on leaving");
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
  await page.clock.install();
  await page.goto(`/stories/${id}`);
  const { title, content, status } = editor(page);

  await title.fill("");
  await content.fill("Written without a title");
  await page.keyboard.press("Control+s");
  await hideTab(page);
  await runAutosaveDelay(page);

  await expect(status).toHaveText("");
  expect(await findStoryById(id)).toMatchObject({
    title: "Untitled soon",
    content: "",
  });

  await title.fill("Titled again");
  await runAutosaveDelay(page);
  await expect(status).toHaveText("Saved");
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

  await expect(status).toHaveText(
    "A story with this title already exists in this folder.",
  );
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
