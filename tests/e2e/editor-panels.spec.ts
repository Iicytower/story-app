import type { Page } from "@playwright/test";
import mongoose from "mongoose";
import {
  findFolder,
  findSettings,
  findStory,
  findStoryById,
  seedStory,
  withE2EDb,
} from "./db";
import { storageStatePath } from "./env";
import { expect, runAutosaveDelay, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Two chapters of "Book"; newest first, so "Second" is listed above "First".
async function seedBook() {
  const first = await seedStory("alice", {
    title: "First",
    folder: "Book",
    content: "First content",
    notes: "First notes",
    createdAt: day(1),
  });
  const second = await seedStory("alice", {
    title: "Second",
    folder: "Book",
    content: "Second content",
    createdAt: day(2),
  });
  return { first, second };
}

const editor = (page: Page) => ({
  title: page.getByRole("textbox", { name: "Title", exact: true }),
  content: page.getByRole("textbox", { name: "Content", exact: true }),
  notes: page.getByRole("textbox", { name: "Notes", exact: true }),
  folderNotes: page.getByRole("textbox", { name: "Folder notes" }),
  folderStatus: page.locator("#folder-notes-status"),
  status: page.getByRole("status"),
  chapters: page.getByRole("list", { name: "Chapters" }),
  sideTab: (name: string) =>
    page
      .getByRole("tablist", { name: "Side panel" })
      .getByRole("tab", { name }),
});

async function width(page: Page, label: string) {
  const box = await page
    .getByRole("textbox", { name: label, exact: true })
    .boundingBox();
  return box!.width;
}

test("separators resize the columns and the notes split, and the layout survives a reload", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await expect(e.notes).toBeVisible();

  const notesWidth = await width(page, "Notes");
  const column = page.getByRole("separator", { name: "Resize notes column" });
  await column.focus();
  for (let i = 0; i < 5; i++) await column.press("ArrowLeft");
  await expect
    .poll(() => width(page, "Notes"))
    .toBeGreaterThan(notesWidth + 20);

  const folderHeight = (await e.folderNotes.boundingBox())!.height;
  const rows = page.getByRole("separator", { name: "Resize folder notes" });
  await rows.focus();
  for (let i = 0; i < 5; i++) await rows.press("ArrowDown");
  await expect
    .poll(async () => (await e.folderNotes.boundingBox())!.height)
    .toBeGreaterThan(folderHeight + 20);

  const resizedWidth = await width(page, "Notes");
  const resizedHeight = (await e.folderNotes.boundingBox())!.height;
  await expect
    .poll(async () => (await findSettings("alice"))?.editorLayout)
    .toMatchObject({
      widths: { "story,notes": expect.any(Object) },
      notesHeights: expect.any(Object),
    });
  await page.reload();
  await expect(e.notes).toBeVisible();
  await expect.poll(() => width(page, "Notes")).toBeCloseTo(resizedWidth, -1);
  await expect
    .poll(async () => (await e.folderNotes.boundingBox())!.height)
    .toBeCloseTo(resizedHeight, -1);
});

test("splits the side panel, reorders and collapses the columns", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);

  await e.sideTab("Chapters").click();
  await expect(e.chapters).toBeVisible();
  await expect(e.notes).toBeHidden();

  await page.getByRole("button", { name: "Split" }).click();
  await expect(e.notes).toBeVisible();
  await expect(e.chapters).toBeVisible();
  const x = async (locator: ReturnType<Page["getByRole"]>) =>
    (await locator.boundingBox())!.x;
  expect(await x(e.notes)).toBeLessThan(await x(e.chapters));
  await expect(
    page.getByRole("button", { name: "Move notes left" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Move notes right" }).click();
  await expect
    .poll(async () => (await x(e.chapters)) < (await x(e.notes)))
    .toBe(true);

  await page.getByRole("button", { name: "Hide chapters" }).click();
  await expect(e.chapters).toBeHidden();
  await expect(e.notes).toBeVisible();
  await page.getByRole("button", { name: "Hide notes" }).click();
  await expect(e.notes).toBeHidden();
  const contentWidth = (await e.content.boundingBox())!.width;
  expect(contentWidth).toBeGreaterThan(500);

  await expect
    .poll(async () => (await findSettings("alice"))?.editorLayout)
    .toMatchObject({ collapsed: { notes: true, chapters: true } });
  await page.reload();
  await expect(e.content).toBeVisible();
  await expect(e.notes).toBeHidden();
  await page.getByRole("button", { name: "Show chapters" }).click();
  await page.getByRole("button", { name: "Show notes" }).click();
  await expect(e.notes).toBeVisible();
  await expect(e.chapters).toBeVisible();
  expect(await x(e.chapters)).toBeLessThan(await x(e.notes));
});

test("folder and chapter notes save separately; folder notes show in another chapter", async ({
  page,
}) => {
  const { first, second } = await seedBook();
  await page.clock.install();
  await page.goto(`/stories/${first}`);
  const e = editor(page);

  await e.folderNotes.fill("Shared world");
  await runAutosaveDelay(page);
  await expect(e.folderStatus).toHaveText("Saved");
  await expect(e.status).toHaveText("");
  expect((await findFolder("Book"))?.notes).toBe("Shared world");
  expect((await findStoryById(first))?.notes).toBe("First notes");

  await e.notes.fill("Only for the first");
  await runAutosaveDelay(page);
  await expect(e.status).toHaveText("Saved");
  expect((await findFolder("Book"))?.notes).toBe("Shared world");

  await page.goto(`/stories/${second}`);
  await expect(e.folderNotes).toHaveText("Shared world");
  await expect(e.notes).toHaveText("");
});

test("folder notes edited in two chapters conflict, chapter autosave does not", async ({
  page,
  context,
}) => {
  const { first, second } = await seedBook();
  await page.clock.install();
  await page.goto(`/stories/${first}`);
  const other = await context.newPage();
  await other.clock.install();
  await other.goto(`/stories/${second}`);
  const a = editor(page);
  const b = editor(other);

  await b.content.fill("Second content, edited");
  await runAutosaveDelay(other);
  await expect(b.status).toHaveText("Saved");
  await b.folderNotes.fill("From the second chapter");
  await runAutosaveDelay(other);
  await expect(b.folderStatus).toHaveText("Saved");

  await a.folderNotes.fill("From the first chapter");
  await runAutosaveDelay(page);
  await expect(a.folderStatus).toHaveText(
    /changed in another tab or on another device/,
  );
  expect((await findFolder("Book"))?.notes).toBe("From the second chapter");
});

test("Chapters panel saves before moving to another chapter", async ({
  page,
}) => {
  const { first, second } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await e.sideTab("Chapters").click();
  await expect(e.chapters.getByRole("link")).toHaveText(["Second", "First"]);
  await expect(e.chapters.getByRole("link", { name: "First" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await e.content.fill("Typed just before leaving");
  await e.chapters.getByRole("link", { name: "Second" }).click();
  await expect(page).toHaveURL(`/stories/${second}`);
  expect((await findStoryById(first))?.content).toBe(
    "Typed just before leaving",
  );
  await expect(e.content).toHaveText("Second content");
});

test("Chapters panel stays on the chapter when saving fails or the title is empty", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await e.sideTab("Chapters").click();

  await e.content.fill("Will conflict");
  await withE2EDb((connection) =>
    connection
      .collection("stories")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(first) },
        { $set: { updatedAt: new Date() } },
      ),
  );
  await e.chapters.getByRole("link", { name: "Second" }).click();
  await expect(e.status).toHaveText(
    /changed in another tab or on another device/,
  );
  await expect(page).toHaveURL(`/stories/${first}`);

  // The Chapters tab must be saved, or the reload opens Notes.
  await expect
    .poll(async () => (await findSettings("alice"))?.editorLayout)
    .toMatchObject({ tab: "chapters" });
  await page.reload();
  await e.title.fill("");
  await e.chapters.getByRole("link", { name: "Second" }).click();
  await expect(e.status).toHaveText("Title is required.");
  await expect(page).toHaveURL(`/stories/${first}`);
});

test("Chapters panel adds, reorders and deletes chapters", async ({ page }) => {
  const { first } = await seedBook();
  const book = await findFolder("Book");
  await withE2EDb((connection) =>
    connection
      .collection("folders")
      .updateOne({ _id: book!._id }, { $set: { chapterSort: "manual" } }),
  );
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await e.sideTab("Chapters").click();
  // Manual order from the seeds: First (position 0), Second (position 1).
  await expect(e.chapters.getByRole("link")).toHaveText(["First", "Second"]);

  const updatedAt = (await findStoryById(first))?.updatedAt;
  await page.getByRole("button", { name: "Move Second up" }).click();
  await expect(e.chapters.getByRole("link")).toHaveText(["Second", "First"]);
  expect((await findStoryById(first))?.updatedAt).toEqual(updatedAt);

  await e.chapters.getByRole("button", { name: "Delete Second" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete story?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(e.chapters.getByRole("link")).toHaveText(["First"]);
  await expect(page).toHaveURL(`/stories/${first}`);

  await page.getByRole("button", { name: "New chapter" }).click();
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  await dialog.getByLabel("Title").fill("Third");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(e.title).toHaveValue("Third");
  await expect(e.chapters.getByRole("link")).toHaveText(["First", "Third"]);
  const third = await findStory("Third");
  expect(third?.deletedAt).toBeNull();

  await e.chapters.getByRole("button", { name: "Delete Third" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete story?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(`/folders/${book!._id}`);
});

test("works with the default layout when localStorage throws", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  const { first } = await seedBook();
  await page.clock.install();
  await page.goto(`/stories/${first}`);
  expect(
    await page.evaluate(() => {
      try {
        void window.localStorage;
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);

  const e = editor(page);
  await expect(e.content).toHaveText("First content");
  await expect(e.notes).toBeVisible();
  await page.getByRole("button", { name: "Split" }).click();
  await expect(e.chapters).toBeVisible();
  await e.content.fill("Saved without storage");
  await runAutosaveDelay(page);
  await expect(e.status).toHaveText("Saved");
});
