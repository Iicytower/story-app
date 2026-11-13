import {
  findFolder,
  findStory,
  findStoryFolder,
  seedFolder,
  seedStory,
} from "./db";
import { storageStatePath } from "./env";
import { expect, hideTab, menuAction, runAutosaveDelay, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("creates a folder, a chapter in it, moves the chapter and deletes the folder", async ({
  page,
}) => {
  await seedFolder("alice", "Archive", new Date("2026-01-01"));

  await page.goto("/books");
  await page.getByRole("button", { name: "New book", exact: true }).click();
  const folderDialog = page.getByRole("dialog", { name: "New book" });
  await folderDialog.getByLabel("Name").fill("Book");
  await folderDialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/books\/[0-9a-f]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Book", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New chapter", exact: true }).click();
  const storyDialog = page.getByRole("dialog", { name: "New chapter" });
  await expect(storyDialog.getByLabel("Book", { exact: true })).toHaveValue(
    "Book",
  );
  await storyDialog.getByLabel("Title").fill("Chapter 1");
  await storyDialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/chapters\/[0-9a-f]{24}$/);

  await page.getByRole("link", { name: "Book", exact: true }).click();
  const chapters = page.getByRole("list", { name: "Chapters" });
  await expect(chapters.getByRole("listitem")).toHaveCount(1);
  await menuAction(page, "Actions for Chapter 1", "Move to…");
  const moveDialog = page.getByRole("dialog", { name: "Move to…" });
  await moveDialog.getByLabel(/Book for/).selectOption({ label: "Archive" });
  await moveDialog.getByRole("button", { name: "Move" }).click();
  await expect(moveDialog).toBeHidden();
  await expect(page.getByText("No chapters yet.")).toBeVisible();
  const archive = await findFolder("Archive");
  expect(await findStoryFolder("Chapter 1")).toBe(archive?._id.toString());

  await page.goto(`/books/${archive?._id}`);
  await menuAction(page, "Actions for Archive", "Delete");
  const deleteDialog = page.getByRole("alertdialog", {
    name: "Delete book?",
  });
  await expect(deleteDialog).toContainText("and its 1 chapter will be removed");
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/en/books");
  await expect(page.getByText("Archive")).toHaveCount(0);
  expect((await findFolder("Archive"))?.deletedAt).toBeInstanceOf(Date);
  expect((await findStory("Chapter 1"))?.deletedAt).toBeInstanceOf(Date);
});

test("creates a new folder from the New chapter dialog", async ({ page }) => {
  await page.goto("/books");
  await page.getByRole("button", { name: "New chapter", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  await dialog.getByLabel("Book", { exact: true }).fill("Typed folder");
  await dialog.getByLabel("Title").fill("First");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/chapters\/[0-9a-f]{24}$/);
  expect(await findFolder("Typed folder")).toMatchObject({ deletedAt: null });
});

test("renames a folder and rejects a duplicate name", async ({ page }) => {
  const id = await seedFolder("alice", "Draft");
  await seedFolder("alice", "Taken");

  await page.goto(`/books/${id}`);
  await menuAction(page, "Actions for Draft", "Rename");
  const dialog = page.getByRole("dialog", { name: "Rename book" });
  await dialog.getByLabel("Name").fill("Taken");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "A book with this name already exists.",
  );

  await dialog.getByLabel("Name").fill("Final");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Final" })).toBeVisible();
});

test("autosaves folder notes 20 seconds after the last keystroke and keeps them after a reload", async ({
  page,
}) => {
  const id = await seedFolder("alice", "Book");

  await page.clock.install();
  await page.goto(`/books/${id}`);
  const notes = page.getByRole("textbox", { name: "Book notes" });
  const status = page.locator("#folder-notes-status");
  await notes.fill("World building");
  await runAutosaveDelay(page, 19_000);
  await expect(status).toHaveText("");
  expect((await findFolder("Book"))?.notes).toBe("");
  await runAutosaveDelay(page, 1000);
  await expect(status).toHaveText("Saved");
  expect((await findFolder("Book"))?.notes).toBe("World building");

  await page.reload();
  await expect(notes).toHaveText("World building");
});

test("hiding the tab saves folder notes at once", async ({ page }) => {
  const id = await seedFolder("alice", "Book");
  await page.goto(`/books/${id}`);

  await page.getByRole("textbox", { name: "Book notes" }).fill("Map");
  await hideTab(page);
  await expect(page.locator("#folder-notes-status")).toHaveText("Saved");
  expect((await findFolder("Book"))?.notes).toBe("Map");
});

test("the folder row menu renames, publishes and deletes a folder", async ({
  page,
}) => {
  await seedStory("alice", { title: "Inside", folder: "Row" });

  await page.goto("/books");
  const row = page
    .getByRole("list", { name: "Books" })
    .getByRole("listitem")
    .filter({ hasText: "Row" });
  await expect(row.getByRole("img")).toHaveAccessibleName("Not public");

  await menuAction(page, "Actions for Row", "Rename");
  const rename = page.getByRole("dialog", { name: "Rename book" });
  await rename.getByLabel("Name").fill("Renamed");
  await rename.getByRole("button", { name: "Save" }).click();
  await expect(rename).toBeHidden();

  await menuAction(page, "Actions for Renamed", "Publish");
  await page
    .getByRole("alertdialog", { name: "Publish book?" })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Books" })
      .getByRole("img", { name: "Public" }),
  ).toBeVisible();
  expect((await findFolder("Renamed"))?.published).toBe(true);

  await menuAction(page, "Actions for Renamed", "Delete");
  const remove = page.getByRole("alertdialog", { name: "Delete book?" });
  await expect(remove).toContainText("and its 1 chapter will be removed");
  await remove.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Renamed")).toHaveCount(0);
  expect((await findFolder("Renamed"))?.deletedAt).toBeInstanceOf(Date);
});

test("search results only open stories", async ({ page }) => {
  await seedStory("alice", { title: "Findable", content: "needle" });

  await page.goto("/books?q=needle");
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("link")).toHaveCount(1);
  await expect(results.getByRole("button")).toHaveCount(0);
  await results.getByRole("link").click();
  await expect(page).toHaveURL(/\/chapters\/[0-9a-f]{24}$/);
});
