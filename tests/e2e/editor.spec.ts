import { findStory, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("loads the title, content and notes of the story", async ({ page }) => {
  const id = await seedStory("alice", {
    title: "Loaded",
    content: "# Heading\n\nSome **bold** text",
    notes: "Remember the dragon",
  });

  await page.goto(`/stories/${id}`);
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toHaveValue("Loaded");
  await expect(
    page.getByRole("textbox", { name: "Content", exact: true }),
  ).toHaveValue("# Heading\n\nSome **bold** text");
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toHaveValue("Remember the dragon");
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("heading", { name: "Heading" })).toBeVisible();
  await expect(preview.locator("strong")).toHaveText("bold");
});

test("shows HTML comments in the textarea but not in the preview", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Comments" });

  await page.goto(`/stories/${id}`);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Visible <!-- inline secret --> text\n\n<!--\nblock secret\n-->");

  await expect(
    page.getByRole("textbox", { name: "Content", exact: true }),
  ).toHaveValue(/inline secret/);
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview).toContainText("Visible");
  await expect(preview).toContainText("text");
  await expect(preview).not.toContainText("secret");
  expect(await preview.innerHTML()).not.toContain("secret");
});

test("renders a single Enter as a line break", async ({ page }) => {
  const id = await seedStory("alice", { title: "Breaks" });

  await page.goto(`/stories/${id}`);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("first line\nsecond line");

  const paragraph = page.getByRole("region", { name: "Preview" }).locator("p");
  await expect(paragraph).toHaveCount(1);
  await expect(paragraph.locator("br")).toHaveCount(1);
});

test("does not execute or render a script from the content", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "XSS" });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto(`/stories/${id}`);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill('<script>alert("xss")</script>\n\n<img src=x onerror="alert(1)">');

  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.locator("script, img")).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test("counts words and characters of the content", async ({ page }) => {
  const id = await seedStory("alice", { title: "Counter" });

  await page.goto(`/stories/${id}`);
  await expect(page.getByText("0 words · 0 characters")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Zażółć  gęślą\njaźń");
  await expect(page.getByText("3 words · 18 characters")).toBeVisible();
});

test("collapses and expands the notes panel", async ({ page }) => {
  const id = await seedStory("alice", { title: "Notes" });

  await page.goto(`/stories/${id}`);
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hide notes" }).click();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Show notes" }).click();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toBeVisible();
});

test("deletes the story and returns to the list", async ({ page }) => {
  const id = await seedStory("alice", { title: "Doomed" });

  await page.goto(`/stories/${id}`);
  await page.getByRole("button", { name: "Delete Doomed" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete story?" });
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL("/stories");
  await expect(page.getByText("No stories yet.")).toBeVisible();
  expect((await findStory("Doomed"))?.deletedAt).toBeInstanceOf(Date);
});

test("returns 404 for another user's story", async ({ page }) => {
  const id = await seedStory("bob", { title: "Bob's secret" });

  const response = await page.goto(`/stories/${id}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByText("Bob's secret")).toHaveCount(0);
});

test("returns 404 for a deleted story", async ({ page }) => {
  const id = await seedStory("alice", {
    title: "Deleted",
    deletedAt: new Date(),
  });

  const response = await page.goto(`/stories/${id}`);
  expect(response?.status()).toBe(404);
});

test("returns 404 for a malformed id", async ({ page }) => {
  const response = await page.goto("/stories/not-an-id");
  expect(response?.status()).toBe(404);
});
