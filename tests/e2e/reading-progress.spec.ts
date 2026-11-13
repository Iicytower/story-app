import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import {
  findFolder,
  clearReadingProgress,
  findReadingProgress,
  seedLibraryItem,
  seedPublished,
  seedReadingProgress,
} from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, menuAction, publicLinkRow, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const LONG = Array.from(
  { length: 150 },
  (_, index) => `Paragraph ${index + 1} of a long chapter.`,
).join("\n\n");
const FIRST = new Date(Date.UTC(2026, 0, 1));
const SECOND = new Date(Date.UTC(2026, 0, 2));

const continueTo = (title: string) =>
  en.public.continue.replace("{title}", title);

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

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("saves the reading position, and Continue reading returns to it", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: LONG, createdAt: FIRST },
    { title: "Two", publication: "public", createdAt: SECOND },
  ]);
  await page.clock.install();
  await page.goto("/en/p/Alice/book/one");
  await expect(
    page.getByText("Paragraph 150 of a long chapter."),
  ).toBeAttached();
  await scrollTo(page, 0.5);
  await page.clock.runFor(10_000);
  await expect
    .poll(async () => (await findReadingProgress("dave"))?.position ?? -1)
    .toBeCloseTo(0.5, 1);
  expect((await findReadingProgress("dave"))?.read).toBe(0);

  await page.reload();
  await page.goto("/en/p/Alice/book");
  await page.getByRole("link", { name: continueTo("One") }).click();
  await expect(page).toHaveURL(/\/en\/p\/Alice\/book\/one\?continue=1$/);
  await expect.poll(() => scrolled(page)).toBeGreaterThan(0.45);
  expect(await scrolled(page)).toBeLessThan(0.55);

  // The end of the chapter marks it read at once.
  await scrollTo(page, 1);
  await expect
    .poll(async () => (await findReadingProgress("dave"))?.read)
    .toBe(1);
  expect((await findReadingProgress("dave"))?.position).toBe(1);
});

test("the library counts a newly published chapter until it is read", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", createdAt: FIRST },
    { title: "Two", publication: "hidden", createdAt: SECOND },
  ]);
  await seedLibraryItem("dave", "alice", "Book");
  const newChapters = (count: number) =>
    page.getByText(count === 1 ? "1 new chapter" : `${count} new chapters`);

  await page.goto("/en/library");
  await expect(
    page.getByRole("link", { name: "Book", exact: true }),
  ).toBeVisible();
  await expect(newChapters(1)).toBeHidden();

  const alice = await loginAs(browser, "alice");
  const folder = await findFolder("Book");
  await alice.page.goto(`/books/${folder!._id.toString()}`);
  await menuAction(alice.page, "Actions for Two", "Publish");
  await alice.page
    .getByRole("alertdialog", { name: "Publish chapter?" })
    .getByRole("button", { name: "Publish", exact: true })
    .click();
  await expect(publicLinkRow(alice.page)).toBeVisible();
  await alice.context.close();

  await page.reload();
  await expect(newChapters(1)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);

  await page.goto("/en/p/Alice/book");
  const chapters = page.getByRole("list", { name: en.public.chapters });
  await expect(
    chapters.getByRole("listitem").filter({ hasText: "2. Two" }),
  ).toContainText(en.public.newChapter);
  await expect(
    chapters.getByRole("listitem").filter({ hasText: "1. One" }),
  ).not.toContainText(en.public.newChapter);
  await expectNoHorizontalScroll(page);

  // A chapter shorter than the window is read once its position is saved.
  await page.clock.install();
  await chapters.getByRole("link", { name: "2. Two" }).click();
  await expect(page.getByRole("heading", { name: "Two" })).toBeVisible();
  await page.clock.runFor(10_000);
  await expect
    .poll(async () => (await findReadingProgress("dave"))?.read)
    .toBe(1);

  await page.goto("/en/library");
  await expect(
    page.getByRole("link", { name: continueTo("Two") }),
  ).toBeVisible();
  await expect(newChapters(1)).toBeHidden();
});

test("long chapter titles in Continue reading and the chapter list fit a narrow screen", async ({
  page,
}) => {
  const spaced = Array.from({ length: 30 }, () => "Chapter").join(" ");
  const unbroken = "Chapter".repeat(30);
  // Added before publication, so both chapters carry the New badge.
  await seedLibraryItem("dave", "alice", "Book");
  await seedPublished("alice", "Book", [
    { title: spaced, publication: "public", createdAt: FIRST },
    { title: unbroken, publication: "public", createdAt: SECOND },
  ]);
  await page.setViewportSize({ width: 375, height: 800 });

  for (const title of [spaced, unbroken]) {
    await clearReadingProgress("dave");
    await seedReadingProgress("dave", "alice", "Book", title);
    await page.goto("/en/p/Alice/book");
    await expect(
      page.getByRole("link", { name: continueTo(title) }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("list", { name: en.public.chapters })
        .getByText(en.public.newChapter),
    ).toHaveCount(2);
    await expectNoHorizontalScroll(page);
  }
});
