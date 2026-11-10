import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import {
  findReaderMarks,
  seedLibraryItem,
  seedPublished,
  setStoryContent,
} from "./db";
import { storageStatePath, USERS } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const PASSAGE = "The old lighthouse keeper waited by the door";
const OPENING = `The storm came at night.\n\n${PASSAGE}, listening to the waves below.`;
const FILLER = Array.from(
  { length: 120 },
  (_, index) => `Paragraph ${index + 1} of a long chapter.`,
).join("\n\n");
const CONTENT = `${OPENING}\n\n${FILLER}`;

const marksCount = (count: number) =>
  en.marks.open.replace("{count, number}", String(count));

function scrolled(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight),
  );
}

async function scrollTo(page: Page, fraction: number) {
  await page.evaluate((share) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: share * max, behavior: "instant" });
  }, fraction);
}

// The ranges of the reader-note highlight, as text.
function highlighted(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const highlight = CSS.highlights.get("reader-note");
    return highlight ? [...highlight].map((range) => range.toString()) : [];
  });
}

async function select(page: Page, text: string) {
  await page.evaluate((phrase) => {
    const walker = document.createTreeWalker(
      document.querySelector("main")!,
      NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const start = node.textContent!.indexOf(phrase);
      if (start === -1) continue;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + phrase.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    throw new Error(`No text ${phrase}`);
  }, text);
}

function toolbar(page: Page) {
  return page.getByRole("toolbar", { name: en.marks.toolbar });
}

async function addNote(page: Page, passage: string, text: string) {
  await select(page, passage);
  await toolbar(page)
    .getByRole("button", { name: en.marks.addNote, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: en.marks.newNote });
  await expect(dialog.getByText(passage, { exact: true })).toBeVisible();
  await dialog.getByLabel(en.marks.text).fill(text);
  await dialog.getByRole("button", { name: en.marks.save }).click();
  await expect(dialog).toBeHidden();
}

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("a bookmark saves the scroll position and the list scrolls back to it", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: CONTENT },
  ]);
  await page.goto("/en/p/Alice/book/one");
  await expect(
    page.getByText("Paragraph 120 of a long chapter."),
  ).toBeAttached();
  await scrollTo(page, 0.5);
  await toolbar(page)
    .getByRole("button", { name: en.marks.addBookmark, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: en.marks.newBookmark });
  await dialog.getByLabel(en.marks.name).fill("Middle");
  await dialog.getByRole("button", { name: en.marks.save }).click();
  await expect(dialog).toBeHidden();
  await expect(
    toolbar(page).getByRole("button", {
      name: en.marks.addBookmark,
      exact: true,
    }),
  ).toBeFocused();
  const [mark] = await findReaderMarks("dave");
  expect(mark).toMatchObject({ kind: "bookmark", name: "Middle" });
  expect(mark.position).toBeCloseTo(0.5, 1);

  await page.reload();
  await expect(toolbar(page)).toBeVisible();
  await scrollTo(page, 0);
  await toolbar(page)
    .getByRole("button", { name: marksCount(1) })
    .click();
  const panel = page.getByRole("dialog", { name: en.marks.panel });
  await panel
    .getByRole("listitem", { name: "Middle" })
    .getByRole("button", { name: en.marks.goTo })
    .click();
  await expect(panel).toBeHidden();
  await expect.poll(() => scrolled(page)).toBeGreaterThan(0.45);
  expect(await scrolled(page)).toBeLessThan(0.55);
  await expect(
    toolbar(page).getByRole("button", { name: marksCount(1) }),
  ).toBeFocused();

  // Escape returns focus to the button that opened the dialog.
  await toolbar(page)
    .getByRole("button", { name: en.marks.addBookmark, exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: en.marks.newBookmark }),
  ).toBeHidden();
  await expect(
    toolbar(page).getByRole("button", {
      name: en.marks.addBookmark,
      exact: true,
    }),
  ).toBeFocused();
});

test("a note on a selected passage is highlighted and listed", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: CONTENT },
  ]);
  await page.goto("/en/p/Alice/book/one");
  await expect(toolbar(page)).toBeVisible();
  await expect(
    toolbar(page).getByRole("button", { name: en.marks.addNote, exact: true }),
  ).toBeHidden();
  await addNote(page, PASSAGE, "Lovely line");
  await expect.poll(() => highlighted(page)).toEqual([PASSAGE]);
  expect(await findReaderMarks("dave")).toEqual([
    expect.objectContaining({
      kind: "note",
      quote: PASSAGE,
      text: "Lovely line",
    }),
  ]);

  await page.reload();
  await expect.poll(() => highlighted(page)).toEqual([PASSAGE]);
  await page.setViewportSize({ width: 375, height: 800 });
  await toolbar(page)
    .getByRole("button", { name: marksCount(1) })
    .click();
  const item = page
    .getByRole("dialog", { name: en.marks.panel })
    .getByRole("listitem", { name: PASSAGE });
  await expect(item).toContainText("Lovely line");
  await expect(item.getByText(en.marks.orphan)).toBeHidden();
  await expectNoHorizontalScroll(page);

  await item.getByRole("button", { name: en.marks.edit }).click();
  const edit = page.getByRole("dialog", { name: en.marks.editNote });
  await edit.getByLabel(en.marks.text).fill("Even better");
  await edit.getByRole("button", { name: en.marks.save }).click();
  await expect(edit).toBeHidden();
  await expect(item).toContainText("Even better");

  await item
    .getByRole("button", { name: en.marks.delete, exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: en.marks.deleteNote })
    .getByRole("button", { name: en.marks.delete, exact: true })
    .click();
  await expect(item).toBeHidden();
  await expect.poll(() => highlighted(page)).toEqual([]);
  expect(await findReaderMarks("dave")).toEqual([]);
});

test("a note follows its moved passage and is orphaned when the author rewrites it", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: CONTENT },
  ]);
  await page.goto("/en/p/Alice/book/one");
  await addNote(page, PASSAGE, "Lovely line");

  // Alice adds a paragraph before the passage.
  await setStoryContent(
    "alice",
    "Book",
    "One",
    `A new opening paragraph.\n\n${CONTENT}`,
  );
  await page.reload();
  await expect.poll(() => highlighted(page)).toEqual([PASSAGE]);

  // Alice rewrites the paragraph with the passage.
  await setStoryContent(
    "alice",
    "Book",
    "One",
    CONTENT.replace(
      `${PASSAGE}, listening to the waves below.`,
      "Nobody stood at the entrance anymore; only the wind remained.",
    ),
  );
  await page.reload();
  await expect(toolbar(page)).toBeVisible();
  await expect.poll(() => highlighted(page)).toEqual([]);
  await toolbar(page)
    .getByRole("button", { name: marksCount(1) })
    .click();
  const item = page
    .getByRole("dialog", { name: en.marks.panel })
    .getByRole("listitem", { name: PASSAGE });
  await expect(item.getByText(en.marks.orphan)).toBeVisible();
  await expect(item).toContainText("Lovely line");
  await expect(item.getByRole("button", { name: en.marks.goTo })).toBeHidden();
});

test("the library lists the marks of a book and opens them in the chapter", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: CONTENT },
  ]);
  await seedLibraryItem("dave", "alice", "Book");
  await page.goto("/en/p/Alice/book/one");
  await expect(
    page.getByText("Paragraph 120 of a long chapter."),
  ).toBeAttached();
  await scrollTo(page, 0.6);
  await toolbar(page)
    .getByRole("button", { name: en.marks.addBookmark, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: en.marks.newBookmark });
  await dialog.getByLabel(en.marks.name).fill("Later");
  await dialog.getByRole("button", { name: en.marks.save }).click();
  await expect(dialog).toBeHidden();
  await scrollTo(page, 0);
  await addNote(page, PASSAGE, "Lovely line");

  await page.goto("/en/library");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByText("2 bookmarks and notes").click();
  await expect(
    page.getByRole("link", { name: `Note – One: ${PASSAGE}` }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: "Bookmark – One: Later" }).click();
  await expect(page).toHaveURL(/\/en\/p\/Alice\/book\/one\?mark=[0-9a-f]{24}$/);
  await expect.poll(() => scrolled(page)).toBeGreaterThan(0.5);
  expect(await scrolled(page)).toBeLessThan(0.7);
});

test("the chapter's author does not see a reader's marks", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: CONTENT },
  ]);
  await page.goto("/en/p/Alice/book/one");
  await addNote(page, PASSAGE, "Lovely line");

  const alice = await browser.newContext({
    storageState: storageStatePath("alice"),
  });
  const alicePage = await alice.newPage();
  await alicePage.goto("/en/p/Alice/book/one");
  await expect(
    toolbar(alicePage).getByRole("button", { name: marksCount(0) }),
  ).toBeVisible();
  expect(await highlighted(alicePage)).toEqual([]);
  await alice.close();
});

test.describe("as a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Bookmark opens the sign-in dialog and comes back to the chapter", async ({
    page,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public", content: CONTENT },
    ]);
    await page.goto("/en/p/Alice/book/one");
    await expect(
      toolbar(page).getByRole("button", { name: marksCount(0) }),
    ).toBeHidden();
    await toolbar(page)
      .getByRole("button", { name: en.marks.addBookmark, exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: en.auth.signIn });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Nickname").fill(USERS.dave.nickname);
    await dialog.getByLabel("Password").fill(USERS.dave.password);
    await dialog.getByRole("button", { name: en.auth.signIn }).click();
    await expect(page).toHaveURL("/en/p/Alice/book/one");
    await expect(
      toolbar(page).getByRole("button", { name: marksCount(0) }),
    ).toBeVisible();
    expect(await findReaderMarks("dave")).toEqual([]);
  });
});
