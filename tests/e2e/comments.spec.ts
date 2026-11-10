import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { findFolder, seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";
const LONG_WORD = "a".repeat(300);

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

const comments = (page: Page) =>
  page.getByRole("list", { name: en.comments.list });

test("dave comments, erin replies, alice turns comments off; a guest reads", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await page.goto(CHAPTER);
  await expect(
    page.getByRole("heading", { name: "Comments", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(en.comments.empty)).toBeVisible();
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill(`Great **chapter** ${LONG_WORD}`);
  await page.getByRole("button", { name: en.comments.submit }).click();
  const first = comments(page).getByRole("listitem").first();
  await expect(first.getByText("chapter", { exact: true })).toBeVisible();
  await expect(first.getByRole("link", { name: "Dave" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 comment" })).toBeVisible();

  await first.getByRole("button", { name: en.comments.edit }).click();
  const editor = page.getByRole("textbox", { name: en.comments.editLabel });
  await editor.fill(`Great chapter, edited ${LONG_WORD}`);
  await page.getByRole("button", { name: en.common.save }).click();
  await expect(first.getByText(en.comments.edited)).toBeVisible();
  // Closing the form gives the focus back to the button that opened it.
  await expect(
    first.getByRole("button", { name: en.comments.edit }),
  ).toBeFocused();

  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await erin.page
    .getByRole("button", {
      name: en.comments.replyTo.replace("{nickname}", "Dave"),
    })
    .click();
  await erin.page
    .getByRole("textbox", {
      name: en.comments.replyTo.replace("{nickname}", "Dave"),
    })
    .fill("Agreed!");
  await erin.page
    .getByRole("button", { name: en.comments.submitReply, exact: true })
    .click();
  const replies = erin.page.getByRole("list", { name: "1 reply" });
  await expect(replies.getByText("Agreed!")).toBeVisible();
  await erin.context.close();

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.goto(CHAPTER);
  await expect(guestPage.getByText("Agreed!")).toBeVisible();
  await expect(
    guestPage.getByRole("textbox", { name: en.comments.newLabel }),
  ).toHaveCount(0);
  await guestPage.getByRole("button", { name: en.comments.signIn }).click();
  await expect(guestPage.getByRole("dialog")).toBeVisible();
  await guestPage.setViewportSize({ width: 375, height: 800 });
  await guestPage.keyboard.press("Escape");
  await expectNoHorizontalScroll(guestPage);
  await guestPage.goto("/en/p/Alice/book");
  await expect(guestPage.getByText("2 comments")).toBeVisible();
  await guest.close();

  // Dave deletes his comment: Erin's reply stays under "Comment deleted".
  await page.reload();
  await page.getByRole("button", { name: en.common.delete }).first().click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: en.common.delete })
    .click();
  await expect(page.getByText(en.comments.deleted)).toBeVisible();
  await expect(page.getByText("Agreed!")).toBeVisible();

  const alice = await loginAs(browser, "alice");
  const book = await findFolder("Book");
  await alice.page.goto(`/en/folders/${book!._id.toString()}`);
  await alice.page
    .getByRole("button", { name: en.menu.actionsFor.replace("{name}", "Book") })
    .click();
  await alice.page
    .getByRole("menuitem", { name: en.menu.disableComments })
    .click();
  // The item changes once the action has refreshed the page.
  await expect(async () => {
    await alice.page.reload();
    await alice.page
      .getByRole("button", {
        name: en.menu.actionsFor.replace("{name}", "Book"),
      })
      .click();
    await expect(
      alice.page.getByRole("menuitem", { name: en.menu.enableComments }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass();
  await alice.context.close();

  await page.reload();
  await expect(page.getByText(en.comments.disabled)).toBeVisible();
  await expect(page.getByText("Agreed!")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: en.comments.newLabel }),
  ).toHaveCount(0);
});

test("the book's contents have their own thread", async ({ page }) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public" },
  ]);
  await page.goto("/en/p/Alice/book");
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("About the whole book");
  await page.getByRole("button", { name: en.comments.submit }).click();
  await expect(comments(page).getByText("About the whole book")).toBeVisible();
  await page.goto(CHAPTER);
  await expect(page.getByText(en.comments.empty)).toBeVisible();
});
