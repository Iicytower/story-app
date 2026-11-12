import {
  findFolder,
  findStory,
  findStoryFolder,
  seedFolder,
  seedStory,
} from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("creates a story from the modal and opens the editor", async ({
  page,
}) => {
  await page.goto("/books");
  await menuAction(page, "Actions", "New chapter");
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  await dialog.getByLabel("Book").fill("Drafts");
  await dialog.getByLabel("Title").fill("Fresh story");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/chapters\/[0-9a-f]{24}$/);
  expect(await findStory("Fresh story")).toMatchObject({ deletedAt: null });
  const folder = await findFolder("Drafts");
  expect(await findStoryFolder("Fresh story")).toBe(folder?._id.toString());
  await expect(page.getByRole("link", { name: "Drafts" })).toBeVisible();
});

test("shows the duplicate title error in the modal", async ({ page }) => {
  await seedStory("alice", { title: "Taken" });

  await page.goto("/books");
  await menuAction(page, "Actions", "New chapter");
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  // Prefilled with the most recently active folder.
  await expect(dialog.getByLabel("Book")).toHaveValue("Unsorted");
  await dialog.getByLabel("Title").fill("Taken");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "A chapter with this title already exists in this book.",
  );
  await expect(dialog.getByLabel("Title")).toHaveValue("Taken");
  await expect(page).toHaveURL("/en/books");
});

test("shows the empty title error in the modal", async ({ page }) => {
  await page.goto("/books");
  await menuAction(page, "Actions", "New chapter");
  const dialog = page.getByRole("dialog", { name: "New chapter" });
  await dialog.getByLabel("Title").fill("   ");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Title is required.");
});

test("deletes a story from the folder after confirmation", async ({ page }) => {
  await seedStory("alice", { title: "Doomed" });
  await seedStory("alice", { title: "Survivor" });

  await page.goto(`/books/${await seedFolder("alice", "Unsorted")}`);
  await menuAction(page, "Actions for Doomed", "Delete");
  const dialog = page.getByRole("alertdialog", { name: "Delete chapter?" });
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("list", { name: "Chapters" }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(page.getByText("Survivor")).toBeVisible();
  expect((await findStory("Doomed"))?.deletedAt).toBeInstanceOf(Date);
});

test("keeps the story when the confirmation is cancelled", async ({ page }) => {
  await seedStory("alice", { title: "Kept" });

  await page.goto(`/books/${await seedFolder("alice", "Unsorted")}`);
  await menuAction(page, "Actions for Kept", "Delete");
  const dialog = page.getByRole("alertdialog", { name: "Delete chapter?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Kept")).toBeVisible();
  expect(await findStory("Kept")).toMatchObject({ deletedAt: null });
});
