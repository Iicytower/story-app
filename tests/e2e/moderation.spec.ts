import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, openMenu, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";
// The menu's name ends with the comment's date.
const MENU_FOR_DAVE = new RegExp(
  `^${en.moderation.menuFor.replace("{nickname}", "Dave").replace("{date}", "")}`,
);
const tab = (name: string) =>
  en.moderation.tab.match(new RegExp(`${name} \\{([^}]+)\\}`))![1];

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("alice invites erin, erin hides dave's comment, alice bans dave who sees why", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await page.goto(CHAPTER);
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Buy cheap stuff");
  await page.getByRole("button", { name: en.comments.submit }).click();
  await expect(page.getByText("Buy cheap stuff")).toBeVisible();
  // A reader has neither the menu nor the panel.
  await expect(page.getByRole("button", { name: MENU_FOR_DAVE })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: en.sidebar.moderation }),
  ).toHaveCount(0);

  const alice = await loginAs(browser, "alice");
  await alice.page.goto("/en/stories");
  await alice.page.getByRole("link", { name: en.sidebar.moderation }).click();
  await expect(
    alice.page.getByRole("heading", { name: en.moderation.ownCommunity }),
  ).toBeVisible();
  await alice.page.getByRole("link", { name: tab("moderators") }).click();
  await alice.page
    .getByRole("form", { name: en.moderation.inviteLabel })
    .getByRole("textbox", { name: en.moderation.nickname })
    .fill("Erin");
  await alice.page
    .getByRole("button", { name: en.moderation.invite, exact: true })
    .click();
  const moderators = alice.page.getByRole("list", {
    name: en.moderation.moderatorList,
  });
  await expect(moderators.getByText(en.moderation.invited)).toBeVisible();

  const erin = await loginAs(browser, "erin");
  await erin.page.goto("/en/moderation");
  await expect(
    erin.page.getByText(
      en.moderation.invitation.replace("{nickname}", "Alice"),
    ),
  ).toBeVisible();
  await erin.page
    .getByRole("button", { name: en.moderation.accept, exact: true })
    .click();
  await expect(
    erin.page.getByRole("heading", {
      name: en.moderation.communityOf.replace("{nickname}", "Alice"),
    }),
  ).toBeVisible();
  // The log is for the author only (D80).
  await expect(erin.page.getByRole("link", { name: tab("other") })).toHaveCount(
    0,
  );

  await erin.page.goto(CHAPTER);
  const menu = erin.page.getByRole("button", { name: MENU_FOR_DAVE });
  const hideItem = erin.page.getByRole("menuitem", {
    name: en.moderation.hide,
    exact: true,
  });
  await openMenu(menu);
  await hideItem.click();
  const hideDialog = erin.page.getByRole("dialog");
  await expect(hideDialog).toBeVisible();
  // Closing the dialog gives the focus back to the menu's button.
  await erin.page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await openMenu(menu);
  await hideItem.click();
  await hideDialog
    .getByRole("textbox", { name: en.moderation.hideReason })
    .fill("Spam");
  await hideDialog
    .getByRole("button", { name: en.moderation.hide, exact: true })
    .click();
  await expect(erin.page.getByText(en.comments.hidden)).toBeVisible();
  await expect(erin.page.getByText("Buy cheap stuff")).toHaveCount(0);
  await erin.context.close();

  await alice.page.goto("/en/moderation");
  await expect(alice.page.getByText("Buy cheap stuff")).toBeVisible();
  await alice.page.getByRole("link", { name: tab("bans") }).click();
  const banForm = alice.page.getByRole("form", {
    name: en.moderation.banSomeone,
  });
  await banForm
    .getByRole("textbox", { name: en.moderation.nickname })
    .fill("Dave");
  await banForm
    .getByRole("combobox", { name: en.moderation.duration })
    .selectOption({ label: "30 days" });
  await banForm
    .getByRole("textbox", { name: en.moderation.banReason })
    .fill("Spam links");
  await banForm
    .getByRole("button", { name: en.moderation.ban, exact: true })
    .click();
  const bans = alice.page.getByRole("list", { name: en.moderation.banList });
  await expect(bans.getByText("Reason: Spam links")).toBeVisible();
  await alice.page.getByRole("link", { name: tab("other") }).click();
  const log = alice.page.getByRole("list", { name: en.moderation.logList });
  await expect(log.getByText("Alice banned Dave")).toBeVisible();
  await expect(log.getByText("Erin hid a comment by Dave")).toBeVisible();
  await expect(log.getByText("Erin accepted the invitation")).toBeVisible();
  await alice.page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(alice.page);
  await alice.context.close();

  await page.reload();
  const notice = page.getByRole("note");
  await expect(
    notice.getByText(en.moderation.bannedHere.replace("{nickname}", "Alice")),
  ).toBeVisible();
  await expect(notice.getByText("Reason: Spam links")).toBeVisible();
  await expect(notice.getByText(/^Until /)).toBeVisible();
  // Reading only: no new comment, reactions and stars do not work.
  await expect(
    page.getByRole("textbox", { name: en.comments.newLabel }),
  ).toHaveCount(0);
  const chapterReactions = page.locator("#reactions").getByRole("button");
  await expect(chapterReactions.first()).toBeDisabled();
  await expect(
    page.locator("#rating").getByRole("button").first(),
  ).toBeDisabled();
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);
});
