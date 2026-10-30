import type { Page } from "@playwright/test";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import {
  expect,
  hideTab,
  markdownEditor,
  runAutosaveDelay,
  test,
} from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

const findBox = (page: Page) => page.getByRole("textbox", { name: "Find" });
const replaceBox = (page: Page) =>
  page.getByRole("textbox", { name: "Replace with" });

test("Ctrl+F finds matches in Preview and steps through them", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Find",
    content: "kot i **Kot**\n\n<!-- kot w komentarzu -->\n\npies",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.getByText("pies").click();
  await page.keyboard.press("Control+f");

  await expect(findBox(page)).toBeFocused();
  await expect(replaceBox(page)).toBeHidden();
  await page.keyboard.type("kot");
  await expect(content.group.getByText("1 of 3")).toBeVisible();
  await expect(content.field.locator("[data-find-current]")).toHaveText("kot");
  await expect(content.field.locator(".bg-yellow-300\\/60")).toHaveCount(2);

  await page.keyboard.press("Enter");
  await expect(content.group.getByText("2 of 3")).toBeVisible();
  await expect(content.field.locator("[data-find-current]")).toHaveText("Kot");
  await page.keyboard.press("Shift+Enter");
  await content.button("Previous match").click();
  await expect(content.group.getByText("3 of 3")).toBeVisible();
  await expect(content.field.locator("aside [data-find-current]")).toHaveText(
    "kot",
  );
  await content.button("Next match").click();
  await expect(content.group.getByText("1 of 3")).toBeVisible();
});

test("options narrow the search and an invalid regex is reported", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Options",
    content: "Kot kot kotek",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("Control+f");
  await page.keyboard.type("kot");
  await expect(content.group.getByText("1 of 3")).toBeVisible();

  await content.button("Match case").click();
  await expect(content.group.getByText("1 of 2")).toBeVisible();
  await content.button("Whole word").click();
  await expect(content.group.getByText("1 of 1")).toBeVisible();
  await content.button("Whole word").click();
  await content.button("Match case").click();

  await content.button("Regular expression").click();
  await findBox(page).fill("kot(ek)?$");
  await expect(content.group.getByText("1 of 1")).toBeVisible();
  await findBox(page).fill("(");
  await expect(
    content.group.getByText("Invalid regular expression"),
  ).toBeVisible();
  await findBox(page).fill("nic");
  await expect(content.group.getByText("No results")).toBeVisible();
  await expect(content.button("Next match")).toBeDisabled();
});

test("the selected text fills the query and Escape selects the match", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Selection",
    content: "pierwszy drugi",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("Home");
  for (let i = 0; i < "pierwszy".length; i++)
    await page.keyboard.press("Shift+ArrowRight");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("pierwszy");
  await page.keyboard.press("Control+f");
  await expect(findBox(page)).toHaveValue("pierwszy");

  await findBox(page).fill("drugi");
  await page.keyboard.press("Escape");
  await expect(findBox(page)).toBeHidden();
  await expect(content.field).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString()))
    .toBe("drugi");
  await expect(content.field.locator("[data-find-current]")).toHaveCount(0);
});

test("the shortcuts stay with the browser outside the field", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Outside", content: "tekst" });
  await page.goto(`/stories/${id}`);
  await page.getByLabel("Title").click();
  await page.keyboard.press("Control+f");
  await expect(findBox(page)).toBeHidden();
});

test("Replace and Replace all in Preview, one Undo, autosave", async ({
  page,
}) => {
  await page.clock.install();
  const id = await seedStory("alice", {
    title: "Replace",
    content: "kot **kot**\n\n<!-- kot -->",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.button("Find and replace").click();

  await page.keyboard.type("kot");
  await expect(content.group.getByText("1 of 3")).toBeVisible();
  await replaceBox(page).fill("kotek");
  await page.keyboard.press("Enter");
  await expect(content.group.getByText("2 of 3")).toBeVisible();
  await expect(content.field.locator("p").first()).toHaveText("kotek kot");

  await content.button("Undo").click();
  await expect(content.field.locator("p").first()).toHaveText("kot kot");

  await replaceBox(page).fill("pies");
  await content.button("Replace all").click();
  await expect(content.group.getByText("No results")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await content.source()).toBe("pies **pies**\n\n<!-- pies -->");

  await content.button("Undo").click();
  expect(await content.source()).toBe("kot **kot**\n\n<!-- kot -->");

  await content.button("Redo").click();
  await runAutosaveDelay(page);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("pies **pies**\n\n<!-- pies -->");
});

test("Find and Replace all in Source, native Undo, autosave", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Source",
    content: "kot **kot**\n\nkot",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.button("Source").click();
  const textarea = content.group.getByRole("textbox", { name: "Content" });
  await textarea.click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+h");

  await page.keyboard.type("**kot**");
  await expect(content.group.getByText("1 of 1")).toBeVisible();
  await expect(content.group.locator("mark")).toHaveText("**kot**");
  await findBox(page).fill("kot");
  await expect(content.group.getByText("1 of 3")).toBeVisible();
  await expect(content.group.locator("mark")).toHaveCount(3);

  await replaceBox(page).fill("kotek");
  await content.button("Replace").click();
  await expect(textarea).toHaveValue("kotek **kot**\n\nkot");
  await expect(content.group.getByText("2 of 3")).toBeVisible();

  await replaceBox(page).fill("pies");
  await content.button("Replace all").click();
  await expect(textarea).toHaveValue("piesek **pies**\n\npies");

  await textarea.focus();
  await page.keyboard.press("Control+z");
  await expect(textarea).toHaveValue("kotek **kot**\n\nkot");
  await page.keyboard.press("Control+Shift+z");
  await hideTab(page);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("piesek **pies**\n\npies");
});

test("works in chapter notes and folder notes", async ({ page }) => {
  const id = await seedStory("alice", {
    title: "Notes",
    content: "kot",
    notes: "kot w notatkach",
  });
  await page.goto(`/stories/${id}`);
  const notes = markdownEditor(page, "Notes");
  await notes.field.getByText("kot w notatkach").click();
  await page.keyboard.press("Control+h");
  await page.keyboard.type("kot");
  await replaceBox(page).fill("pies");
  await notes.button("Replace all").click();
  await page.keyboard.press("Escape");
  await expect(notes.field).toHaveText("pies w notatkach");
  await expect(markdownEditor(page, "Content").field).toHaveText("kot");

  const folderNotes = markdownEditor(page, "Folder notes");
  await folderNotes.field.click();
  await page.keyboard.type("kot i kot");
  await page.keyboard.press("Control+h");
  await page.keyboard.type("kot");
  await expect(folderNotes.group.getByText("1 of 2")).toBeVisible();
  await replaceBox(page).fill("pies");
  await folderNotes.button("Replace all").click();
  await page.keyboard.press("Escape");
  await expect(folderNotes.field).toHaveText("pies i pies");
});
