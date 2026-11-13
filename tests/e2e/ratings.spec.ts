import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const BOOK = "/en/p/Alice/book";
const CHAPTER = `${BOOK}/one`;

const stars = (page: Page, name: string) => page.getByRole("group", { name });
const star = (page: Page, group: string, label: string) =>
  stars(page, group).getByRole("button", { name: label, exact: true });

test("dave rates alice's chapter and book; a guest sees the averages and signs in to rate", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await page.goto(CHAPTER);
  await expect(page.getByText("No ratings yet")).toBeVisible();
  await star(page, en.ratings.chapter, "4 stars").click();
  await expect(star(page, en.ratings.chapter, "4 stars")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("4.0 · 1 rating")).toBeVisible();
  // Another value replaces it.
  await star(page, en.ratings.chapter, "2 stars").click();
  await expect(star(page, en.ratings.chapter, "2 stars")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(star(page, en.ratings.chapter, "4 stars")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(page.getByText("2.0 · 1 rating")).toBeVisible();
  await expect(star(page, en.ratings.chapter, "2 stars")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto(BOOK);
  await star(page, en.ratings.book, "5 stars").click();
  await expect(page.getByText("5.0 · 1 rating")).toBeVisible();
  await expect(
    stars(page, en.ratings.book).locator("svg.fill-amber-400"),
  ).toHaveCount(5);

  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await star(erin.page, en.ratings.chapter, "5 stars").click();
  await expect(erin.page.getByText("3.5 · 2 ratings")).toBeVisible();
  // The chosen star again takes the rating off; then she rates once more.
  await star(erin.page, en.ratings.chapter, "5 stars").click();
  await expect(erin.page.getByText("2.0 · 1 rating")).toBeVisible();
  await star(erin.page, en.ratings.chapter, "5 stars").click();
  await expect(erin.page.getByText("3.5 · 2 ratings")).toBeVisible();
  await erin.context.close();

  // The author sees the average and cannot rate.
  const alice = await loginAs(browser, "alice");
  await alice.page.goto(CHAPTER);
  await expect(alice.page.getByText("3.5 · 2 ratings")).toBeVisible();
  await expect(alice.page.getByText(en.ratings.own)).toBeVisible();
  await expect(stars(alice.page, en.ratings.chapter)).toHaveCount(0);
  // Ratings are anonymous: not even the author's page names a rater.
  const raterIds = await withE2EDb(async (db) =>
    (
      await db.collection("ratings").find().project({ userId: 1 }).toArray()
    ).map(({ userId }) => String(userId)),
  );
  expect(raterIds).toHaveLength(3);
  const aliceHtml = await alice.page.content();
  for (const raterId of raterIds) expect(aliceHtml).not.toContain(raterId);
  await alice.context.close();

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.setViewportSize({ width: 375, height: 800 });
  await guestPage.goto(CHAPTER);
  await expect(guestPage.getByText("3.5 · 2 ratings")).toBeVisible();
  const guestHtml = await guestPage.content();
  for (const raterId of raterIds) expect(guestHtml).not.toContain(raterId);
  expect(
    await guestPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await star(guestPage, en.ratings.chapter, "3 stars").click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guestPage.keyboard.press("Escape");
  await expect(star(guestPage, en.ratings.chapter, "3 stars")).toBeFocused();

  await guestPage.goto(BOOK);
  await expect(guestPage.getByText("5.0 · 1 rating")).toBeVisible();
  // The stars stand for the reader's own rating only, never for the average (D83).
  await expect(guestPage.getByText(en.ratings.yours)).toBeVisible();
  await expect(
    stars(guestPage, en.ratings.book).locator("svg.fill-amber-400"),
  ).toHaveCount(0);
  await star(guestPage, en.ratings.book, "1 star").click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guest.close();
});
