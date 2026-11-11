import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";

const chapterBar = (page: Page) =>
  page.getByRole("group", { name: en.reactions.chapter });
const commentBar = (page: Page, nickname: string) =>
  page.getByRole("group", {
    name: en.reactions.comment.replace("{nickname}", nickname),
  });
test("dave and erin react to a chapter and a comment; a guest sees the counts and signs in to react", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await page.goto(CHAPTER);
  await chapterBar(page)
    .getByRole("button", { name: "Heart: no reactions", exact: true })
    .click();
  const daveHeart = chapterBar(page).getByRole("button", {
    name: "Heart: 1 reaction",
    exact: true,
  });
  await expect(daveHeart).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Lovely");
  await page.getByRole("button", { name: en.comments.submit }).click();
  // One's own comment takes no reactions.
  await expect(
    commentBar(page, "Dave").getByRole("button", {
      name: "Heart: no reactions",
      exact: true,
    }),
  ).toBeDisabled();

  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await chapterBar(erin.page)
    .getByRole("button", { name: "Heart: 1 reaction", exact: true })
    .click();
  await expect(
    chapterBar(erin.page).getByRole("button", {
      name: "Heart: 2 reactions",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await commentBar(erin.page, "Dave")
    .getByRole("button", { name: "Fire: no reactions", exact: true })
    .click();
  await expect(
    commentBar(erin.page, "Dave").getByRole("button", {
      name: "Fire: 1 reaction",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await chapterBar(erin.page)
    .getByRole("button", { name: `${en.reactions.who}: 2 reactions` })
    .click();
  const list = erin.page.getByRole("list", { name: en.reactions.who });
  await expect(list.getByRole("link", { name: "Erin" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Dave" })).toBeVisible();
  await erin.page.keyboard.press("Escape");
  await erin.context.close();

  // Another reaction replaces Dave's; the same one again takes it off.
  await page.reload();
  await chapterBar(page)
    .getByRole("button", { name: "Laughing: no reactions", exact: true })
    .click();
  await expect(
    chapterBar(page).getByRole("button", {
      name: "Laughing: 1 reaction",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    chapterBar(page).getByRole("button", {
      name: "Heart: 1 reaction",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await chapterBar(page)
    .getByRole("button", { name: "Laughing: 1 reaction", exact: true })
    .click();
  await expect(
    chapterBar(page).getByRole("button", {
      name: "Laughing: no reactions",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.setViewportSize({ width: 375, height: 800 });
  await guestPage.goto(CHAPTER);
  await expect(
    chapterBar(guestPage).getByRole("button", {
      name: "Heart: 1 reaction",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    commentBar(guestPage, "Dave").getByRole("button", {
      name: "Fire: 1 reaction",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await guestPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // The six reactions stay in one row on a narrow screen.
  const tops = await commentBar(guestPage, "Dave")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.slice(0, 6).map((button) => button.getBoundingClientRect().top),
    );
  expect(new Set(tops).size).toBe(1);
  await chapterBar(guestPage)
    .getByRole("button", { name: `${en.reactions.who}: 1 reaction` })
    .click();
  await expect(
    guestPage
      .getByRole("list", { name: en.reactions.who })
      .getByRole("link", { name: "Erin" }),
  ).toBeVisible();
  await guestPage.keyboard.press("Escape");
  await chapterBar(guestPage)
    .getByRole("button", { name: "Heart: 1 reaction", exact: true })
    .click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guestPage.keyboard.press("Escape");
  await expect(
    chapterBar(guestPage).getByRole("button", {
      name: "Heart: 1 reaction",
      exact: true,
    }),
  ).toBeFocused();
  await commentBar(guestPage, "Dave")
    .getByRole("button", { name: "Fire: 1 reaction", exact: true })
    .click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guest.close();
});
