import type { Page } from "@playwright/test";
import mongoose from "mongoose";
import {
  findFolder,
  findSettings,
  findStory,
  findStoryById,
  seedSettings,
  seedStory,
  withE2EDb,
} from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, runAutosaveDelay, test } from "./helpers";

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
  tools: page.getByRole("list", { name: "Tools" }),
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
    .poll(async () => (await findSettings("alice"))?.editor?.layout)
    .toMatchObject({
      widths: { "story-column": expect.any(Number) },
      notesHeights: expect.any(Object),
    });
  await page.reload();
  await expect(e.notes).toBeVisible();
  await expect.poll(() => width(page, "Notes")).toBeCloseTo(resizedWidth, -1);
  await expect
    .poll(async () => (await e.folderNotes.boundingBox())!.height)
    .toBeCloseTo(resizedHeight, -1);
});

test("there is no Split mode; a hidden side panel stays hidden after a reload", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await expect(e.notes).toBeVisible();
  await expect(page.getByRole("button", { name: "Split" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);

  await e.sideTab("Chapters").click();
  await expect(e.chapters).toBeVisible();
  await page.getByRole("button", { name: "Hide chapters" }).click();
  await expect(e.chapters).toBeHidden();
  await expect(e.notes).toBeHidden();
  expect((await e.content.boundingBox())!.width).toBeGreaterThan(500);

  await expect
    .poll(async () => (await findSettings("alice"))?.editor?.layout)
    .toMatchObject({ tab: "chapters", collapsed: { chapters: true } });
  await page.reload();
  await expect(e.content).toBeVisible();
  await expect(e.chapters).toBeHidden();
  await page.getByRole("button", { name: "Show chapters" }).click();
  await expect(e.chapters).toBeVisible();
  await expect(e.sideTab("Chapters")).toHaveAttribute("aria-selected", "true");
});

test("Tools shows tiles, and a tile opens its tool in a dialog", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await e.content.fill("Kept while using tools");

  await e.sideTab("Tools").click();
  await expect(e.tools.getByRole("button")).toHaveText([
    "Proofread",
    "Name generator",
    "Definitions",
    "Synonyms",
    "Rhymes",
  ]);
  await expect(e.notes).toBeHidden();

  await e.tools.getByRole("button", { name: "Rhymes" }).click();
  const dialog = page.getByRole("dialog", { name: "Rhymes" });
  await expect(dialog.getByRole("textbox", { name: "Word" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await expect(dialog).toBeHidden();
  await expect(e.tools).toBeVisible();

  await e.sideTab("Notes").click();
  await expect(e.notes).toBeVisible();
  await expect(e.content).toHaveText("Kept while using tools");
});

test("an open tool survives a move to a narrow screen and back", async ({
  page,
}) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await e.sideTab("Tools").click();
  await e.tools.getByRole("button", { name: "Synonyms" }).click();
  const dialog = page.getByRole("dialog", { name: "Synonyms" });
  await expect(dialog).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("tablist", { name: "View" })).toBeAttached();
  await expect(dialog).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(dialog).toBeVisible();
});

test("the side panel keeps one width across its tabs", async ({ page }) => {
  const { first } = await seedBook();
  await page.goto(`/stories/${first}`);
  const e = editor(page);
  await expect(e.notes).toBeVisible();

  const column = page.getByRole("separator", { name: "Resize notes column" });
  await column.focus();
  for (let i = 0; i < 5; i++) await column.press("ArrowLeft");
  const resized = (await e.content.boundingBox())!.width;

  await e.sideTab("Tools").click();
  await expect(e.tools).toBeVisible();
  expect((await e.content.boundingBox())!.width).toBeCloseTo(resized, 0);
  await e.sideTab("Chapters").click();
  await expect(e.chapters).toBeVisible();
  expect((await e.content.boundingBox())!.width).toBeCloseTo(resized, 0);
});

test("a stored Split layout shows the tabs with the saved tab width", async ({
  page,
}) => {
  const { first } = await seedBook();
  await seedSettings("alice", {
    editor: {
      layout: {
        split: true,
        tab: "chapters",
        order: ["tools", "chapters", "notes"],
        collapsed: { notes: false, chapters: false, tools: false },
        widths: {
          "story,tools,chapters,notes": {
            "story-column": 40,
            "tools-column": 20,
            "chapters-column": 20,
            "notes-column": 20,
          },
          "story,side": { "story-column": 50, "side-column": 50 },
        },
      },
    },
  });
  await page.goto(`/stories/${first}`);
  const e = editor(page);

  await expect(e.sideTab("Chapters")).toHaveAttribute("aria-selected", "true");
  await expect(e.chapters).toBeVisible();
  await expect(e.notes).toBeHidden();
  await expect(e.tools).toBeHidden();
  const side = (await e.chapters.boundingBox())!;
  const story = (await e.content.boundingBox())!;
  expect(side.width).toBeGreaterThan(story.width * 0.7);
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
  await expect(page).toHaveURL(`/en/stories/${second}`);
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
  await expect(page).toHaveURL(`/en/stories/${first}`);

  // The Chapters tab must be saved, or the reload opens Notes.
  await expect
    .poll(async () => (await findSettings("alice"))?.editor?.layout)
    .toMatchObject({ tab: "chapters" });
  await page.reload();
  await e.title.fill("");
  await e.chapters.getByRole("link", { name: "Second" }).click();
  await expect(e.status).toHaveText("Title is required.");
  await expect(page).toHaveURL(`/en/stories/${first}`);
});

test("Chapters panel lists chapters in manual order and adds one, without row actions", async ({
  page,
}) => {
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
  await expect(
    e.chapters.getByRole("listitem").getByRole("button"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "New chapter" }).click();
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  await dialog.getByLabel("Title").fill("Third");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(e.title).toHaveValue("Third");
  await expect(e.chapters.getByRole("link")).toHaveText([
    "First",
    "Second",
    "Third",
  ]);
  expect((await findStory("Third"))?.deletedAt).toBeNull();

  await menuAction(page, "Actions for Third", "Delete");
  await page
    .getByRole("alertdialog", { name: "Delete story?" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL(`/en/folders/${book!._id}`);
  expect((await findStory("Third"))?.deletedAt).toBeInstanceOf(Date);
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
  await e.sideTab("Chapters").click();
  await expect(e.chapters).toBeVisible();
  await e.content.fill("Saved without storage");
  await runAutosaveDelay(page);
  await expect(e.status).toHaveText("Saved");
});
