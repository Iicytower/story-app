import { findStory, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("creates a story from the modal and opens the editor", async ({
  page,
}) => {
  await page.goto("/stories");
  await page.getByRole("button", { name: "New story" }).click();
  const dialog = page.getByRole("dialog", { name: "New story" });
  await dialog.getByLabel("Title").fill("Fresh story");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/stories\/[0-9a-f]{24}$/);
  expect(await findStory("Fresh story")).toMatchObject({ deletedAt: null });
});

test("shows the duplicate title error in the modal", async ({ page }) => {
  await seedStory("alice", { title: "Taken" });

  await page.goto("/stories");
  await page.getByRole("button", { name: "New story" }).click();
  const dialog = page.getByRole("dialog", { name: "New story" });
  await dialog.getByLabel("Title").fill("Taken");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "A story with this title already exists.",
  );
  await expect(dialog.getByLabel("Title")).toHaveValue("Taken");
  await expect(page).toHaveURL("/stories");
});

test("shows the empty title error in the modal", async ({ page }) => {
  await page.goto("/stories");
  await page.getByRole("button", { name: "New story" }).click();
  const dialog = page.getByRole("dialog", { name: "New story" });
  await dialog.getByLabel("Title").fill("   ");
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Title is required.");
});

test("deletes a story from the list after confirmation", async ({ page }) => {
  await seedStory("alice", { title: "Doomed" });
  await seedStory("alice", { title: "Survivor" });

  await page.goto("/stories");
  await page.getByRole("button", { name: "Delete Doomed" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete story?" });
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByText("Survivor")).toBeVisible();
  expect((await findStory("Doomed"))?.deletedAt).toBeInstanceOf(Date);
});

test("keeps the story when the confirmation is cancelled", async ({ page }) => {
  await seedStory("alice", { title: "Kept" });

  await page.goto("/stories");
  await page.getByRole("button", { name: "Delete Kept" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete story?" });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Kept")).toBeVisible();
  expect(await findStory("Kept")).toMatchObject({ deletedAt: null });
});
