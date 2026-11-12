import type { Browser, Page } from "@playwright/test";
import en from "@/messages/en.json";
import pl from "@/messages/pl.json";
import { findSettings, seedPublished } from "./db";
import { storageStatePath } from "./env";
import {
  countActionRequests,
  expect,
  hideTab,
  loginAs,
  openSettings,
  test,
} from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const CHAPTER = "/en/p/Alice/book/one";
const POLL_MS = 30_000;

// The label of the bell in en.sidebar.notificationsUnread, with the count.
const bell = (page: Page, unread = 0) =>
  page.getByRole("button", {
    name:
      unread > 0 ? `Notifications, ${unread} unread` : en.sidebar.notifications,
    exact: true,
  });

async function daveComments(browser: Browser, text: string) {
  const dave = await loginAs(browser, "dave");
  await dave.page.goto(CHAPTER);
  await dave.page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill(text);
  await dave.page.getByRole("button", { name: en.comments.submit }).click();
  await expect(dave.page.getByText(text)).toBeVisible();
  await dave.context.close();
}

async function showTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

test.beforeEach(async () => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
});

test("dave comments; alice sees the counter after polling, the panel and the comment", async ({
  page,
  browser,
}) => {
  await page.clock.install();
  await page.goto("/en/books");
  await expect(bell(page)).toBeVisible();

  await daveComments(browser, "Lovely chapter");
  await page.clock.runFor(POLL_MS);
  await expect(bell(page, 1)).toBeVisible();
  await expect(page.getByText("You have a new notification")).toBeVisible();

  await bell(page, 1).click();
  const panel = page.getByRole("dialog", { name: en.notifications.title });
  await expect(
    panel.getByRole("heading", { name: en.notifications.title }),
  ).toBeFocused();
  // One Escape closes it, and the focus goes back to the bell.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(bell(page, 1)).toBeFocused();
  await bell(page, 1).click();
  const item = panel
    .getByRole("group", { name: en.notifications.list })
    .getByRole("button", { name: /Dave commented on “One”/ });
  await expect(item).toBeVisible();
  await expect(item.getByRole("img", { name: "Unread" })).toBeVisible();
  await item.click();
  await expect(page).toHaveURL(
    /\/en\/p\/Alice\/book\/one#comment-[0-9a-f]{24}$/,
  );
  await expect(page.getByText("Lovely chapter")).toBeVisible();
  // The reader pages have no sidebar: the bell is back to no unread elsewhere.
  await page.goto("/en/books");
  await expect(bell(page)).toBeVisible();
});

test("mark all as read, and the panel on a narrow screen", async ({
  page,
  browser,
}) => {
  await daveComments(browser, "First");
  await daveComments(browser, "Second");
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/en/books");
  const menu = (name: string) =>
    page.getByRole("button", { name, exact: true });
  await menu(en.sidebar.menuUnread).click();
  await bell(page, 2).click();
  const panel = page.getByRole("dialog", { name: en.notifications.title });
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel
    .getByRole("button", { name: en.notifications.markAllRead })
    .click();
  await expect(panel.getByRole("img", { name: "Unread" })).toHaveCount(0);
  await expect(
    panel.getByRole("group", { name: en.notifications.list }),
  ).toBeFocused();
  // Below md the bell is in the closed drawer: the focus goes to the menu.
  await page.keyboard.press("Escape");
  await expect(menu(en.sidebar.menu)).toBeFocused();
  await menu(en.sidebar.menu).click();
  await expect(bell(page)).toBeVisible();
});

test("relative times with the full date in the title, grouped today and earlier", async ({
  page,
  browser,
}) => {
  await daveComments(browser, "Fresh");
  await page.goto("/en/books");
  await bell(page, 1).click();
  const panel = page.getByRole("dialog", { name: en.notifications.title });
  const today = panel.getByRole("list", { name: en.notifications.today });
  await expect(today.getByRole("listitem")).toHaveCount(1);
  await expect(today.getByRole("time")).toHaveText(/^(now|\d+ minutes? ago)$/);
  await expect(today.getByRole("time")).toHaveAttribute(
    "title",
    /^\w+ \d+, \d{4} at \d+:\d{2} [AP]M$/,
  );
  await expect(
    panel.getByRole("heading", { name: en.notifications.earlier }),
  ).toHaveCount(0);

  // Two days later the same notification is earlier.
  await page.clock.install({ time: Date.now() + 2 * 24 * 60 * 60_000 });
  await page.reload();
  await bell(page, 1).click();
  const earlier = panel.getByRole("list", { name: en.notifications.earlier });
  await expect(earlier.getByRole("time")).toHaveText("2 days ago");
  await expect(
    panel.getByRole("heading", { name: en.notifications.today }),
  ).toHaveCount(0);

  await page.clock.setSystemTime(Date.now() + 3 * 60 * 60_000);
  await page.goto("/pl/books");
  await page
    .getByRole("button", {
      name: `${pl.sidebar.notifications}, 1 nieprzeczytane`,
    })
    .click();
  const plPanel = page.getByRole("dialog", { name: pl.notifications.title });
  await expect(plPanel.getByRole("time")).toHaveText("3 godziny temu");
  await expect(plPanel.getByRole("time")).toHaveAttribute(
    "title",
    /^\d+ \p{L}+ \d{4} \d+:\d{2}$/u,
  );
});

test("a kind turned off in the settings creates no notification", async ({
  page,
  browser,
}) => {
  await page.goto("/en/books");
  const settings = await openSettings(page);
  const comments = settings
    .getByRole("group", { name: en.settings.notificationGroups.interactions })
    .getByRole("checkbox", { name: en.settings.notificationTypes.comment });
  await expect(comments).toBeChecked();
  await comments.uncheck();
  await expect
    .poll(async () => (await findSettings("alice"))?.notifications?.comment)
    .toBe(false);

  await daveComments(browser, "Nobody tells Alice");
  await page.reload();
  await expect(bell(page)).toBeVisible();
});

test("polls only while the tab is visible", async ({ page, browser }) => {
  await page.clock.install();
  await page.goto("/en/books");
  await expect(bell(page)).toBeVisible();
  await hideTab(page);
  const requests = countActionRequests(page);

  await daveComments(browser, "While away");
  await page.clock.runFor(3 * POLL_MS);
  expect(requests).toEqual([]);
  await expect(bell(page)).toBeVisible();

  await showTab(page);
  await expect(bell(page, 1)).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
});
