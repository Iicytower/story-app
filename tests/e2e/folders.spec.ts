import { findFolder, findStory, findStoryFolder, seedFolder } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("creates a folder, a chapter in it, moves the chapter and deletes the folder", async ({
  page,
}) => {
  await seedFolder("alice", "Archive", new Date("2026-01-01"));

  await page.goto("/stories");
  await page.getByRole("button", { name: "New folder" }).click();
  const folderDialog = page.getByRole("dialog", { name: "New folder" });
  await folderDialog.getByLabel("Name").fill("Book");
  await folderDialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/folders\/[0-9a-f]{24}$/);
  await expect(page.getByRole("heading", { name: "Book" })).toBeVisible();

  await page.getByRole("button", { name: "New story" }).click();
  const storyDialog = page.getByRole("dialog", { name: "New story" });
  await expect(storyDialog.getByLabel("Folder")).toHaveValue("Book");
  await storyDialog.getByLabel("Title").fill("Chapter 1");
  await storyDialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/stories\/[0-9a-f]{24}$/);

  await page.getByRole("link", { name: "Book" }).click();
  const chapters = page.getByRole("list", { name: "Chapters" });
  await expect(chapters.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Move Chapter 1" }).click();
  const moveDialog = page.getByRole("dialog", { name: "Move to…" });
  await moveDialog.getByLabel(/Folder for/).selectOption({ label: "Archive" });
  await moveDialog.getByRole("button", { name: "Move" }).click();
  await expect(moveDialog).toBeHidden();
  await expect(page.getByText("No chapters yet.")).toBeVisible();
  const archive = await findFolder("Archive");
  expect(await findStoryFolder("Chapter 1")).toBe(archive?._id.toString());

  await page.goto(`/folders/${archive?._id}`);
  await page.getByRole("button", { name: "Delete" }).first().click();
  const deleteDialog = page.getByRole("alertdialog", {
    name: "Delete folder?",
  });
  await expect(deleteDialog).toContainText("and its 1 chapter will be removed");
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/stories");
  await expect(page.getByText("Archive")).toHaveCount(0);
  expect((await findFolder("Archive"))?.deletedAt).toBeInstanceOf(Date);
  expect((await findStory("Chapter 1"))?.deletedAt).toBeInstanceOf(Date);
});

test("creates a new folder from the New story dialog", async ({ page }) => {
  await page.goto("/stories");
  await page.getByRole("button", { name: "New story" }).click();
  const dialog = page.getByRole("dialog", { name: "New story" });
  await dialog.getByLabel("Folder").fill("Typed folder");
  await dialog.getByLabel("Title").fill("First");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/stories\/[0-9a-f]{24}$/);
  expect(await findFolder("Typed folder")).toMatchObject({ deletedAt: null });
});

test("renames a folder and rejects a duplicate name", async ({ page }) => {
  const id = await seedFolder("alice", "Draft");
  await seedFolder("alice", "Taken");

  await page.goto(`/folders/${id}`);
  await page.getByRole("button", { name: "Rename" }).click();
  const dialog = page.getByRole("dialog", { name: "Rename folder" });
  await dialog.getByLabel("Name").fill("Taken");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "A folder with this name already exists.",
  );

  await dialog.getByLabel("Name").fill("Final");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Final" })).toBeVisible();
});

test("autosaves folder notes and keeps them after a reload", async ({
  page,
}) => {
  const id = await seedFolder("alice", "Book");

  await page.goto(`/folders/${id}`);
  const notes = page.getByRole("textbox", { name: "Folder notes" });
  await notes.fill("World building");
  await expect(page.getByRole("status")).toHaveText("Saved", {
    timeout: 10_000,
  });
  expect((await findFolder("Book"))?.notes).toBe("World building");

  await page.reload();
  await expect(notes).toHaveValue("World building");
});
