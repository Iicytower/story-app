import { findStory, seedStory, seedFolder } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

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
  const content = markdownEditor(page, "Content");
  await expect(
    content.field.getByRole("heading", { name: "Heading" }),
  ).toBeVisible();
  await expect(content.field.locator("strong")).toHaveText("bold");
  await expect(markdownEditor(page, "Notes").field).toHaveText(
    "Remember the dragon",
  );
  expect(await content.source()).toBe("# Heading\n\nSome **bold** text");
});

test("shows a comment as an editable block and keeps it in the source", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Comments",
    content: "Visible text\n\n<!-- loaded note -->",
  });

  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  const comments = content.field.locator("aside[data-comment]");
  await expect(comments).toHaveText(["loaded note"]);

  await content.field.getByText("Visible text").click();
  await page.keyboard.press("End");
  await content.button("Comment").click();
  await page.keyboard.type("new note");
  await expect(comments).toHaveText(["new note", "loaded note"]);
  await comments.last().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" edited");

  expect(await content.source()).toBe(
    "Visible text\n\n<!-- new note -->\n\n<!-- loaded note edited -->",
  );
});

test("Enter starts a paragraph and Shift+Enter breaks the line", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Breaks" });

  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.type("first");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second");
  await page.keyboard.press("Enter");
  await page.keyboard.type("third");

  await expect(content.field.locator("p")).toHaveCount(2);
  await expect(content.field.locator("p").first().locator("br")).toHaveCount(1);
  expect(await content.source()).toBe("first  \nsecond\n\nthird");
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
  const content = markdownEditor(page, "Content");
  await content.setSource(
    '<script>alert("xss")</script>\n\n<img src=x onerror="alert(1)">',
  );

  await expect(content.field.locator("script, img")).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test("counts words and characters of the markdown", async ({ page }) => {
  const id = await seedStory("alice", { title: "Counter" });

  await page.goto(`/stories/${id}`);
  await expect(
    page.getByText("0 words · 0 characters · 0 minutes read aloud"),
  ).toBeVisible();
  await markdownEditor(page, "Content").setSource("Zażółć  gęślą\njaźń");
  await expect(
    page.getByText("3 words · 18 characters · 1 minute read aloud"),
  ).toBeVisible();
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

test("deletes the story and returns to its folder", async ({ page }) => {
  const id = await seedStory("alice", { title: "Doomed", folder: "Book" });
  const folderId = await seedFolder("alice", "Book");

  await page.goto(`/stories/${id}`);
  await page.getByRole("button", { name: "Delete Doomed" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete story?" });
  await dialog.getByRole("button", { name: "Delete" }).click();

  await expect(page).toHaveURL(`/folders/${folderId}`);
  await expect(page.getByText("No chapters yet.")).toBeVisible();
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
