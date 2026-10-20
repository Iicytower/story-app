import type { Page } from "@playwright/test";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

// Types a line, selects it and applies a toolbar button or a shortcut.
async function formatLine(
  page: Page,
  text: string,
  apply: () => Promise<void>,
) {
  const content = markdownEditor(page, "Content");
  await content.setSource("");
  await content.field.click();
  await page.keyboard.type(text);
  await expect(content.field).toHaveText(text);
  await page.keyboard.press("Shift+Home");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe(text);
  await apply();
  return content.source();
}

test("each toolbar button produces the expected markdown", async ({ page }) => {
  const id = await seedStory("alice", { title: "Toolbar" });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  const click = (name: string) => () => content.button(name).click();

  const cases: [string, string][] = [
    ["Bold", "**text**"],
    ["Italic", "*text*"],
    ["Heading 1", "# text"],
    ["Heading 2", "## text"],
    ["Heading 3", "### text"],
    ["Bulleted list", "- text"],
    ["Numbered list", "1. text"],
    ["Quote", "> text"],
  ];
  for (const [button, markdown] of cases) {
    expect(await formatLine(page, "text", click(button)), button).toBe(
      markdown,
    );
  }

  await content.setSource("text");
  await content.field.getByText("text").click();
  await page.keyboard.press("End");
  await content.button("Horizontal line").click();
  expect(await content.source()).toBe("text\n\n---");

  await content.setSource("");
  await content.field.click();
  await page.keyboard.type("before");
  await content.button("Comment").click();
  await page.keyboard.type("my note");
  expect(await content.source()).toBe("before\n\n<!-- my note -->");

  await content.button("Undo").click();
  await expect(content.field).not.toContainText("my note");
  await content.button("Redo").click();
  await expect(content.field.locator("aside[data-comment]")).toHaveText(
    "my note",
  );
});

test("shortcuts format text and Ctrl+K adds a safe link", async ({ page }) => {
  const id = await seedStory("alice", { title: "Shortcuts" });
  await page.goto(`/stories/${id}`);

  expect(
    await formatLine(page, "text", () => page.keyboard.press("Control+b")),
  ).toBe("**text**");
  expect(
    await formatLine(page, "text", () => page.keyboard.press("Control+i")),
  ).toBe("*text*");

  const source = await formatLine(page, "site", async () => {
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Link" });
    await dialog.getByLabel("URL").fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Use an http, https or mailto link.",
    );
    await dialog.getByLabel("URL").fill("https://example.com");
    await dialog.getByRole("button", { name: "Apply" }).click();
    await expect(dialog).toBeHidden();
  });
  expect(source).toBe("[site](https://example.com)");
});

test("Source and Preview keep the text and unsaved changes", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Modes",
    content: "Start",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await expect(content.button("Preview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await content.setSource("## From source\n\n- one\n- two");
  await expect(
    content.field.getByRole("heading", { name: "From source" }),
  ).toBeVisible();
  await expect(content.field.getByRole("listitem")).toHaveText(["one", "two"]);

  await content.field.getByText("two").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" and three");
  expect(await content.source()).toBe(
    "## From source\n\n- one\n- two and three",
  );

  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText("Saved");
  expect((await findStoryById(id))?.content).toBe(
    "## From source\n\n- one\n- two and three",
  );

  await page.reload();
  await expect(content.button("Preview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("opening a story without editing does not save it", async ({ page }) => {
  // Markdown the serializer would write differently (`__` instead of `**`).
  const id = await seedStory("alice", {
    title: "Untouched",
    content: "Some __bold__ text\nwith a break",
    updatedAt: new Date("2026-01-01"),
  });
  await page.goto(`/stories/${id}`);
  await expect(
    markdownEditor(page, "Content").field.locator("strong"),
  ).toHaveText("bold");

  await page.waitForTimeout(4000);
  await expect(page.getByRole("status")).toHaveText("");
  expect(await findStoryById(id)).toMatchObject({
    content: "Some __bold__ text\nwith a break",
    updatedAt: new Date("2026-01-01"),
  });
});

test("a comment written in the editor is not on the public page", async ({
  page,
  browser,
}) => {
  const id = await seedStory("alice", {
    title: "Public",
    content: "Public text",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.getByText("Public text").click();
  await page.keyboard.press("End");
  await content.button("Comment").click();
  await page.keyboard.type("private-note-5e1f");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("button", { name: "Share", exact: true }).click();
  const url = await page
    .getByRole("textbox", { name: "Share link" })
    .inputValue();
  const visitor = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const response = await (await visitor.newPage()).goto(url);
  const html = await response!.text();
  expect(html).toContain("Public text");
  expect(html).not.toContain("private-note-5e1f");
  await visitor.close();
});

test("chapter and folder notes use the same editor with Preview and Source", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Notes", folder: "Book" });
  await page.goto(`/stories/${id}`);

  for (const label of ["Notes", "Folder notes"]) {
    const notes = markdownEditor(page, label);
    await notes.field.click();
    await page.keyboard.type("idea");
    await page.keyboard.press("Shift+Home");
    await notes.button("Bold").click();
    expect(await notes.source(), label).toBe("**idea**");
  }
});
