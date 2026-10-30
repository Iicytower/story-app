import type { Locator, Page } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

// Headings and comments are much taller in Preview than in Source, so matching the scroll
// by proportion would land far from the same text. Every source line is short, so it never wraps.
const CONTENT = Array.from({ length: 120 }, (_, i) =>
  i < 50 && i % 2 === 0
    ? `# Heading ${i}`
    : i % 7 === 0
      ? `<!-- comment ${i}\nsecond line\nthird line -->`
      : `Paragraph ${i}`,
).join("\n\n");

const NOTES = Array.from({ length: 80 }, (_, i) => `Note ${i}`).join("\n\n");

async function seedLongBook(chapterCount = 1) {
  const id = await seedStory("alice", {
    title: "Long",
    folder: "Book",
    content: CONTENT,
    notes: NOTES,
    createdAt: day(1),
  });
  for (let i = 1; i < chapterCount; i++)
    await seedStory("alice", {
      title: `Chapter ${i}`,
      folder: "Book",
      createdAt: day(i + 1),
    });
  return id;
}

// The element that scrolls a rich text field.
const scroller = (field: Locator) => field.locator("xpath=..");

const scrollTop = (locator: Locator) =>
  locator.evaluate((element) => element.scrollTop);

async function scrollTo(locator: Locator, top: number) {
  await locator.evaluate((element, top) => {
    element.scrollTop = top;
  }, top);
  await expect.poll(() => scrollTop(locator)).toBeGreaterThan(0);
}

// Scrolls the rich text field so that the given block starts at its top edge.
async function scrollPreviewToText(field: Locator, text: string) {
  await field
    .getByText(text, { exact: true })
    .evaluate((block) => block.scrollIntoView({ block: "start" }));
}

async function isInView(container: Locator, target: Locator) {
  const outer = (await container.boundingBox())!;
  const inner = (await target.boundingBox())!;
  return (
    inner.y >= outer.y - 1 &&
    inner.y + inner.height <= outer.y + outer.height + 1
  );
}

// Whether the textarea shows the line starting with `text` (lines never wrap here).
function sourceShowsLine(textarea: Locator, text: string) {
  return textarea.evaluate((element: HTMLTextAreaElement, text) => {
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
    const line =
      element.value.slice(0, element.value.indexOf(text)).split("\n").length -
      1;
    const view = element.parentElement!.parentElement!.getBoundingClientRect();
    const top = element.getBoundingClientRect().top + line * lineHeight;
    return top >= view.top - lineHeight / 2 && top + lineHeight <= view.bottom;
  }, text);
}

async function expectSameTextAfterSwitching(page: Page) {
  const content = markdownEditor(page, "Content");
  const field = content.field;
  await expect(field).toBeVisible();
  await expect(field.getByText("Paragraph 61", { exact: true })).toBeAttached();

  await scrollPreviewToText(field, "Paragraph 61");
  await content.button("Source").click();
  const textarea = content.group.getByRole("textbox");
  expect(await sourceShowsLine(textarea, "Paragraph 61")).toBe(true);
  expect(await sourceShowsLine(textarea, "# Heading 0")).toBe(false);

  const line =
    CONTENT.slice(0, CONTENT.indexOf("Paragraph 89")).split("\n").length - 1;
  await textarea.evaluate((element: HTMLTextAreaElement, line) => {
    const scroller = element.parentElement!.parentElement!;
    scroller.scrollTop +=
      element.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      line * parseFloat(getComputedStyle(element).lineHeight);
  }, line);
  await content.button("Preview").click();
  await expect
    .poll(() =>
      isInView(
        scroller(field),
        field.getByText("Paragraph 89", { exact: true }),
      ),
    )
    .toBe(true);
}

// Long prose paragraphs, each wrapping over several lines in Source as well.
const WRAPPED = Array.from(
  { length: 40 },
  (_, i) => `Long ${i}: ` + "słowo i jeszcze jedno zdanie, ".repeat(12),
).join("\n\n");

// Distance from the top of the textarea's visible text to the first line of `text`,
// measured with a plain copy of the field rather than the editor's own code.
function sourceLineOffset(textarea: Locator, text: string) {
  return textarea.evaluate((element: HTMLTextAreaElement, text) => {
    const style = getComputedStyle(element);
    const copy = element.cloneNode() as HTMLTextAreaElement;
    Object.assign(copy.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: `${element.offsetWidth}px`,
      height: "0",
    });
    copy.value = element.value.slice(0, element.value.indexOf(text));
    document.body.append(copy);
    // The text before ends with a newline, so its last (empty) line is where `text` starts.
    const lineTop =
      copy.scrollHeight -
      parseFloat(style.paddingBottom) -
      parseFloat(style.lineHeight);
    copy.remove();
    const view = element.parentElement!.parentElement!.getBoundingClientRect();
    return {
      offset:
        element.getBoundingClientRect().top +
        lineTop -
        parseFloat(style.paddingTop) -
        view.top,
      lineHeight: parseFloat(style.lineHeight),
    };
  }, text);
}

async function expectWrappedParagraphAfterSwitching(page: Page) {
  const content = markdownEditor(page, "Content");
  const block = content.field.locator("p", { hasText: "Long 25:" });
  await expect(block).toBeAttached();
  await block.evaluate((element) => element.scrollIntoView({ block: "start" }));

  await content.button("Source").click();
  const { offset, lineHeight } = await sourceLineOffset(
    content.group.getByRole("textbox"),
    "Long 25:",
  );
  expect(Math.abs(offset)).toBeLessThan(lineHeight / 2);
}

// Text of the first top-level block of a rich text field that reaches below its top edge.
function topBlock(field: Locator) {
  return field.evaluate((element) => {
    const top = element.parentElement!.getBoundingClientRect().top;
    const block = [...element.children].find(
      (child) => child.getBoundingClientRect().bottom > top + 1,
    );
    return block?.textContent ?? null;
  });
}

// Positions reach localStorage a moment after scrolling stops.
async function waitForScrollSave(page: Page, field: string) {
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("story-app:scroll") ?? ""),
    )
    .toContain(`"${field}"`);
}

test.describe("wide screen", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("Preview and Source show the same text after switching", async ({
    page,
  }) => {
    await page.goto(`/stories/${await seedLongBook()}`);
    await expectSameTextAfterSwitching(page);
  });

  test("Source starts at the same wrapped paragraph as Preview", async ({
    page,
  }) => {
    const id = await seedStory("alice", { title: "Wrapped", content: WRAPPED });
    await page.goto(`/stories/${id}`);
    await expectWrappedParagraphAfterSwitching(page);
  });

  test("Notes and Chapters keep their scroll and leave the story where it was", async ({
    page,
  }) => {
    await page.goto(`/stories/${await seedLongBook(40)}`);
    const content = scroller(markdownEditor(page, "Content").field);
    const notes = scroller(markdownEditor(page, "Notes").field);
    const chapters = page.getByRole("list", { name: "Chapters" });
    const tab = (name: string) =>
      page
        .getByRole("tablist", { name: "Side panel" })
        .getByRole("tab", { name });
    await expect(page.getByText("Note 79", { exact: true })).toBeAttached();

    await scrollTo(content, 1500);
    await scrollTo(notes, 400);
    const contentTop = await scrollTop(content);
    const notesTop = await scrollTop(notes);

    await tab("Chapters").click();
    await expect(chapters).toBeVisible();
    expect(await scrollTop(content)).toBe(contentTop);
    await scrollTo(chapters, 300);
    const chaptersTop = await scrollTop(chapters);

    await tab("Notes").click();
    await expect(markdownEditor(page, "Notes").field).toBeVisible();
    expect(await scrollTop(notes)).toBe(notesTop);
    expect(await scrollTop(content)).toBe(contentTop);

    await tab("Chapters").click();
    await expect(chapters).toBeVisible();
    expect(await scrollTop(chapters)).toBe(chaptersTop);
    expect(await scrollTop(content)).toBe(contentTop);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
  test("positions survive a reload", async ({ page }) => {
    const id = await seedLongBook(40);
    await page.goto(`/stories/${id}`);
    const content = markdownEditor(page, "Content").field;
    const notes = markdownEditor(page, "Notes").field;
    const chapters = page.getByRole("list", { name: "Chapters" });
    const tab = (name: string) =>
      page
        .getByRole("tablist", { name: "Side panel" })
        .getByRole("tab", { name });
    await expect(page.getByText("Note 79", { exact: true })).toBeAttached();

    await scrollPreviewToText(content, "Paragraph 61");
    await scrollTo(scroller(notes), 400);
    const notesTop = await topBlock(notes);
    await tab("Chapters").click();
    await scrollTo(chapters, 300);
    await tab("Notes").click();
    for (const field of ["content", "notes", "chapters"])
      await waitForScrollSave(page, field);

    await page.reload();
    await expect.poll(() => topBlock(content)).toBe("Paragraph 61");
    await expect.poll(() => topBlock(notes)).toBe(notesTop);
    await tab("Chapters").click();
    expect(await scrollTop(chapters)).toBe(300);
  });

  test("Split and Hide keep the story position", async ({ page }) => {
    await page.goto(`/stories/${await seedLongBook()}`);
    const content = markdownEditor(page, "Content").field;
    await expect(
      content.getByText("Paragraph 61", { exact: true }),
    ).toBeAttached();
    await scrollPreviewToText(content, "Paragraph 61");

    await page.getByRole("button", { name: "Split" }).click();
    await expect(page.getByRole("list", { name: "Chapters" })).toBeVisible();
    await expect.poll(() => topBlock(content)).toBe("Paragraph 61");

    await page.getByRole("button", { name: "Hide notes" }).click();
    await expect(
      page.getByRole("button", { name: "Show notes" }),
    ).toBeVisible();
    await expect.poll(() => topBlock(content)).toBe("Paragraph 61");
  });
});

test.describe("narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Preview and Source show the same text after switching", async ({
    page,
  }) => {
    await page.goto(`/stories/${await seedLongBook()}`);
    await expectSameTextAfterSwitching(page);
  });

  test("Source starts at the same wrapped paragraph as Preview", async ({
    page,
  }) => {
    const id = await seedStory("alice", { title: "Wrapped", content: WRAPPED });
    await page.goto(`/stories/${id}`);
    await expectWrappedParagraphAfterSwitching(page);
  });

  test("Story, Notes and Chapters keep their scroll", async ({ page }) => {
    await page.goto(`/stories/${await seedLongBook(40)}`);
    const content = scroller(markdownEditor(page, "Content").field);
    const notes = scroller(markdownEditor(page, "Notes").field);
    const chapters = page.getByRole("list", { name: "Chapters" });
    const tab = (name: string) =>
      page.getByRole("tablist", { name: "View" }).getByRole("tab", { name });
    await expect(
      page.getByText("Paragraph 118", { exact: true }),
    ).toBeAttached();

    await scrollTo(content, 1500);
    const contentTop = await scrollTop(content);

    await tab("Notes").click();
    await expect(markdownEditor(page, "Notes").field).toBeVisible();
    await scrollTo(notes, 300);
    const notesTop = await scrollTop(notes);

    await tab("Chapters").click();
    await expect(chapters).toBeVisible();
    await scrollTo(chapters, 300);
    const chaptersTop = await scrollTop(chapters);

    await tab("Notes").click();
    await expect(markdownEditor(page, "Notes").field).toBeVisible();
    expect(await scrollTop(notes)).toBe(notesTop);

    await tab("Chapters").click();
    await expect(chapters).toBeVisible();
    expect(await scrollTop(chapters)).toBe(chaptersTop);

    await tab("Story").click();
    await expect(markdownEditor(page, "Content").field).toBeVisible();
    expect(await scrollTop(content)).toBe(contentTop);
  });
  test("the story position survives a reload", async ({ page }) => {
    await page.goto(`/stories/${await seedLongBook()}`);
    const content = markdownEditor(page, "Content").field;
    await expect(
      content.getByText("Paragraph 61", { exact: true }),
    ).toBeAttached();
    await scrollPreviewToText(content, "Paragraph 61");
    await waitForScrollSave(page, "content");

    await page.reload();
    await expect.poll(() => topBlock(content)).toBe("Paragraph 61");
  });
});
