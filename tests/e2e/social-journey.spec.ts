import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import {
  seedPublished,
  seedRanking,
  seedReadingProgress,
  seedStory,
} from "./db";
import { storageStatePath } from "./env";
import {
  expect,
  expectSignedOut,
  loginAs,
  openMenu,
  openSettings,
  publishFromEditor,
  test,
} from "./helpers";

// The whole social system on alice (author), dave and erin (readers) and admin (task 91).

const BOOK = "/en/p/Alice/book";
const CHAPTER = `${BOOK}/one`;

const bell = (page: Page) =>
  page.getByRole("button", { name: /^Notifications, \d+ unread$/ });
const notification = (page: Page, text: RegExp) =>
  page
    .getByRole("dialog", { name: en.notifications.title })
    .getByRole("button", { name: text });
const comments = (page: Page) =>
  page.getByRole("list", { name: en.comments.list });

async function comment(page: Page, text: string) {
  await page.getByRole("textbox", { name: en.comments.newLabel }).fill(text);
  await page.getByRole("button", { name: en.comments.submit }).click();
  await expect(comments(page).getByText(text)).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.describe("a reader", () => {
  test.use({ storageState: storageStatePath("dave") });

  test("follows, reads the feed and the library, comments, reacts, rates and is notified", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public", content: "Chapter text" },
    ]);
    const two = await seedStory("alice", {
      title: "Two",
      folder: "Book",
      content: "Second chapter",
    });

    // Profile and following.
    await page.goto("/en/p/Alice");
    await page
      .getByRole("button", { name: en.profile.follow, pressed: false })
      .click();
    await expect(page.getByRole("link", { name: "1 follower" })).toBeVisible();

    // Publication and the feed.
    const alice = await loginAs(browser, "alice");
    await alice.page.goto(`/chapters/${two}`);
    await publishFromEditor(alice.page);
    await page.goto("/en/feed");
    const entries = page.getByRole("list", { name: en.feed.entries });
    await expect(entries.getByRole("link", { name: "Two" })).toBeVisible();

    // The library and "Continue reading".
    await page.goto(BOOK);
    await page.getByRole("button", { name: en.library.add }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Reading", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await page.goto("/en/library");
    await expect(
      page.getByRole("link", { name: "Book", exact: true }),
    ).toBeVisible();
    await seedReadingProgress("dave", "alice", "Book", "One");
    await page.goto(BOOK);
    await page
      .getByRole("link", { name: en.public.continue.replace("{title}", "One") })
      .click();
    await expect(page).toHaveURL(`${CHAPTER}?continue=1`);

    // A comment with a mention, a reaction and a rating.
    await comment(page, "Great start, @Erin should read it");
    await expect(
      page.getByRole("link", { name: "@Erin", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("group", { name: en.reactions.chapter })
      .getByRole("button", { name: "Heart: no reactions", exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: en.reactions.chapter })
        .getByRole("button", { name: "Heart: 1 reaction", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("group", { name: en.ratings.chapter })
      .getByRole("button", { name: "4 stars", exact: true })
      .click();
    await expect(page.getByText("4.0 average from 1 rating")).toBeVisible();

    // Notifications: the new chapter for dave, the mention for erin, the follower for alice.
    await page.goto("/en/books");
    await bell(page).click();
    await expect(
      notification(page, /Alice published a new chapter in “Book”/),
    ).toBeVisible();
    const erin = await loginAs(browser, "erin");
    await erin.page.goto("/en/books");
    await bell(erin.page).click();
    await notification(
      erin.page,
      /Dave mentioned you in a comment on “One”/,
    ).click();
    await expect(erin.page).toHaveURL(
      /\/en\/p\/Alice\/book\/one#comment-[0-9a-f]{24}$/,
    );
    await erin.context.close();
    await alice.page.goto("/en/books");
    await bell(alice.page).click();
    await expect(
      notification(alice.page, /Dave started following you/),
    ).toBeVisible();
    await alice.context.close();
  });
});

test.describe("the community", () => {
  test.use({ storageState: storageStatePath("alice") });

  test("messages, a report the author resolves, a block, the forum and the admin's moderation", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public", content: "Chapter text" },
    ]);
    const dave = await loginAs(browser, "dave");
    const erin = await loginAs(browser, "erin");

    // A direct message from dave to alice.
    await dave.page.goto("/en/p/Alice");
    await dave.page.getByRole("button", { name: en.profile.message }).click();
    const dialog = dave.page.getByRole("dialog", { name: "Message to Alice" });
    await dialog
      .getByRole("textbox", { name: en.messages.newLabel })
      .fill("Hello Alice");
    await dialog.getByRole("button", { name: en.messages.send }).click();
    await expect(dave.page).toHaveURL(/\/en\/messages\/[0-9a-f]{24}$/);
    await page.goto("/en/messages");
    await page
      .getByRole("list", { name: en.messages.list })
      .getByRole("link", { name: /Dave/ })
      .click();
    await expect(page.getByRole("log").getByText("Hello Alice")).toBeVisible();

    // Erin's spam, reported by dave and resolved by alice in her community.
    await erin.page.goto(CHAPTER);
    await comment(erin.page, "Buy cheap stuff");
    await dave.page.goto(CHAPTER);
    await openMenu(
      dave.page.getByRole("button", {
        name: /^Actions for the comment by Erin/,
      }),
    );
    await dave.page
      .getByRole("menuitem", { name: en.reports.report, exact: true })
      .click();
    const report = dave.page.getByRole("dialog", { name: "Report comment" });
    await report
      .getByRole("combobox", { name: en.reports.reason })
      .selectOption({ label: "Spam" });
    await report.getByRole("button", { name: en.reports.send }).click();
    await expect(report.getByText(en.reports.sent)).toBeVisible();
    await dave.page.keyboard.press("Escape");

    await page.goto("/en/moderation");
    await page
      .getByRole("link", {
        name: en.moderation.tab.match(/reports \{([^}]+)\}/)![1],
      })
      .click();
    const reports = page.getByRole("list", { name: en.moderation.reportList });
    await expect(reports.getByText("Buy cheap stuff")).toBeVisible();
    await reports.getByRole("button", { name: /^Resolve the report/ }).click();
    await expect(page.getByText(en.moderation.noReports)).toBeVisible();

    // Alice blocks erin: her comment is gone for alice, still there for dave.
    await page.goto("/en/p/Erin");
    await page.getByRole("button", { name: "Block Erin" }).click();
    await page
      .getByRole("alertdialog", { name: "Block Erin?" })
      .getByRole("button", { name: en.blocking.block })
      .click();
    await expect(
      page.getByRole("button", { name: "Unblock Erin" }),
    ).toBeVisible();
    await page.goto(CHAPTER);
    await expect(page.getByText("Chapter text")).toBeVisible();
    await expect(page.getByText("Buy cheap stuff")).toHaveCount(0);
    await dave.page.reload();
    await expect(dave.page.getByText("Buy cheap stuff")).toBeVisible();

    // The forum: dave starts a thread in the workshop, erin answers with spam.
    await dave.page.goto("/en/forums/workshop");
    await dave.page.getByLabel(en.forums.threadTitle).fill("Pacing help");
    await dave.page
      .getByRole("textbox", { name: en.forums.threadBody })
      .fill("How do I fix pacing?");
    await dave.page
      .getByRole("button", { name: en.forums.submitThread })
      .click();
    await expect(
      dave.page.getByRole("heading", { name: "Pacing help" }),
    ).toBeVisible();
    const threadUrl = dave.page.url();
    await erin.page.goto(threadUrl);
    await erin.page
      .getByRole("textbox", { name: en.forums.newPost })
      .fill("Visit my spam shop");
    await erin.page
      .getByRole("button", { name: en.forums.submitPost, exact: true })
      .last()
      .click();
    const posts = (target: Page) =>
      target.getByRole("list", { name: en.forums.postList });
    await expect(
      posts(erin.page).getByText("Visit my spam shop"),
    ).toBeVisible();

    // Dave reports the post; in a category it goes to the admin, who hides it.
    await dave.page.reload();
    await openMenu(
      dave.page.getByRole("button", { name: /^Actions for the post by Erin/ }),
    );
    await dave.page
      .getByRole("menuitem", { name: en.reports.report, exact: true })
      .click();
    const postReport = dave.page.getByRole("dialog", { name: "Report post" });
    await postReport
      .getByRole("combobox", { name: en.reports.reason })
      .selectOption({ label: "Spam" });
    await postReport.getByRole("button", { name: en.reports.send }).click();
    await expect(postReport.getByText(en.reports.sent)).toBeVisible();
    await dave.page.keyboard.press("Escape");

    const admin = await loginAs(browser, "admin");
    await admin.page.goto("/en/admin");
    const queue = admin.page.getByRole("list", {
      name: en.moderation.reportList,
    });
    await expect(queue.getByText("Visit my spam shop")).toBeVisible();
    await queue
      .getByRole("button", { name: /^Hide the content reported/ })
      .click();
    await admin.page
      .getByRole("alertdialog", { name: en.admin.hideTitle })
      .getByRole("button", { name: en.moderation.hide })
      .click();
    await expect(admin.page.getByRole("alertdialog")).toBeHidden();
    await admin.context.close();

    await dave.page.reload();
    await expect(posts(dave.page).getByText("Visit my spam shop")).toHaveCount(
      0,
    );
    await expect(
      posts(dave.page).getByText("How do I fix pacing?"),
    ).toBeVisible();
    await dave.context.close();
    await erin.context.close();
  });

  test("statistics count the readers of alice's book, and a seeded ranking lists it on the home page", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public", content: "Chapter text" },
    ]);
    for (const reader of ["dave", "erin"] as const) {
      const { context, page: readerPage } = await loginAs(browser, reader);
      await readerPage.goto(CHAPTER);
      await expect(readerPage.getByText("Chapter text")).toBeVisible();
      await context.close();
    }
    await page.goto("/en/stats");
    await expect(
      page
        .getByRole("row")
        .filter({
          has: page.getByRole("rowheader", { name: "One", exact: true }),
        })
        .getByRole("cell")
        .first(),
    ).toHaveText("2");

    await seedRanking("weekly", [{ user: "alice", folder: "Book" }]);
    await page.goto("/en");
    const weekly = page
      .getByRole("list", { name: "Popular this week", exact: true })
      .getByRole("link");
    await expect(weekly).toHaveCount(1);
    await expect(weekly).toHaveAttribute("href", BOOK);
    await page.setViewportSize({ width: 375, height: 800 });
    await expectNoHorizontalScroll(page);
  });
});

test.describe("a new account", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("registers, follows and comments, then deletes itself", async ({
    page,
    browser,
  }) => {
    const password = "Harbor-lantern-8642!";
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public", content: "Chapter text" },
    ]);
    await page.goto("/");
    await page.getByRole("button", { name: "Log in / Create account" }).click();
    await page.getByRole("button", { name: "Create one" }).click();
    await page.getByLabel("Nickname").fill("Grace");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Repeat password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    const codes = page.getByRole("dialog", {
      name: "Save your recovery codes",
    });
    await codes.getByLabel("I have saved these codes").check();
    await codes.getByRole("button", { name: "Continue" }).click();

    await page.goto("/en/p/Alice");
    await page
      .getByRole("button", { name: en.profile.follow, pressed: false })
      .click();
    await expect(page.getByRole("link", { name: "1 follower" })).toBeVisible();
    await page.goto(CHAPTER);
    await comment(page, "Hello from Grace");

    await page.goto("/en/books");
    const settings = await openSettings(page, "Account");
    await settings
      .getByRole("button", { name: en.settings.deleteAccount })
      .click();
    const form = page.getByRole("dialog", { name: en.deleteAccount.title });
    await form.getByLabel(en.deleteAccount.password).fill(password);
    await form.getByLabel(en.deleteAccount.nickname).fill("Grace");
    await form.getByRole("button", { name: en.deleteAccount.confirm }).click();
    await expectSignedOut(page);

    const alice = await loginAs(browser, "alice");
    // The cleanup runs after the response.
    await expect(async () => {
      await alice.page.goto("/en/p/Alice");
      await expect(
        alice.page.getByRole("link", { name: "0 followers" }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    await alice.page.goto(CHAPTER);
    const item = comments(alice.page).getByRole("listitem").first();
    await expect(item.getByText("Hello from Grace")).toBeVisible();
    await expect(item.getByText(en.comments.deletedUser)).toBeVisible();
    expect((await alice.page.goto("/en/p/Grace"))?.status()).toBe(404);
    await alice.context.close();
  });
});
