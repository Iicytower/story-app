import type { Browser, Page } from "@playwright/test";
import en from "@/messages/en.json";
import { storageStatePath } from "./env";
import {
  countActionRequests,
  expect,
  loginAs,
  realtime,
  test,
} from "./helpers";

// Task 90: erin's page gets dave's message and notification from the (fake) realtime service
// without the polling clock moving; with the service down it polls (D80).
test.use({ storageState: storageStatePath("erin") });

const POLL_MS = 30_000;

const messagesLink = (page: Page, unread = 0) =>
  page.getByRole("navigation", { name: en.sidebar.mainNav }).getByRole("link", {
    name:
      unread === 0 ? en.sidebar.messages : `Messages, ${unread} unread conversation`,
    exact: true,
  });

const bell = (page: Page, unread = 0) =>
  page.getByRole("button", {
    name:
      unread > 0 ? `Notifications, ${unread} unread` : en.sidebar.notifications,
    exact: true,
  });

const streamOpened = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.url().includes("/rt/stream") && response.status() === 200,
  );

async function daveWrites(browser: Browser, text: string) {
  const dave = await loginAs(browser, "dave");
  await dave.page.goto("/en/p/Erin");
  await dave.page.getByRole("button", { name: en.profile.message }).click();
  const dialog = dave.page.getByRole("dialog", { name: "Message to Erin" });
  await dialog.getByRole("textbox", { name: en.messages.newLabel }).fill(text);
  await dialog.getByRole("button", { name: en.messages.send }).click();
  await expect(dave.page).toHaveURL(/\/en\/messages\/[0-9a-f]{24}$/);
  return dave;
}

test.afterEach(async () => {
  await realtime("down");
});

test("a new message and notification reach the open tab without polling (3)", async ({
  page,
  browser,
}) => {
  await realtime("up");
  await page.clock.install();
  const opened = streamOpened(page);
  await page.goto("/en/books");
  await opened;
  await expect(messagesLink(page)).toBeVisible();
  // With the stream up the counters do not poll.
  const requests = countActionRequests(page);
  await page.clock.runFor(2 * POLL_MS);
  expect(requests).toEqual([]);

  const dave = await daveWrites(browser, "Hello Erin");
  await expect(messagesLink(page, 1)).toBeVisible();

  await messagesLink(page, 1).click();
  await page
    .getByRole("list", { name: en.messages.list })
    .getByRole("link", { name: /Dave/ })
    .click();
  const thread = page.getByRole("log", { name: en.messages.thread });
  await expect(thread.getByText("Hello Erin")).toBeVisible();

  await dave.page
    .getByRole("textbox", { name: en.messages.newLabel })
    .fill("Are you there?");
  await dave.page.getByRole("button", { name: en.messages.send }).click();
  await expect(thread.getByText("Are you there?")).toBeVisible();

  await dave.page.goto("/en/p/Erin");
  await dave.page.getByRole("button", { name: en.profile.follow }).click();
  await expect(bell(page, 1)).toBeVisible();
  await dave.context.close();
});

test("polls while the realtime service is down or goes down (4)", async ({
  page,
  browser,
}) => {
  await page.clock.install();
  await page.goto("/en/books");
  await expect(messagesLink(page)).toBeVisible();

  const first = await daveWrites(browser, "While it is down");
  await first.context.close();
  await expect(messagesLink(page, 1)).toBeHidden();
  await page.clock.runFor(POLL_MS);
  await expect(messagesLink(page, 1)).toBeVisible();

  // Up: a stream opens at the next retry (30 s, then 60 s after the second failure); then it
  // stops and the polling comes back.
  await realtime("up");
  const opened = streamOpened(page);
  await page.clock.runFor(2 * POLL_MS);
  await opened;
  await realtime("down");
  const dave = await loginAs(browser, "dave");
  await dave.page.goto("/en/p/Erin");
  await dave.page.getByRole("button", { name: en.profile.follow }).click();
  await expect(
    dave.page.getByRole("button", { name: en.profile.unfollow }),
  ).toHaveAttribute("aria-pressed", "true");
  await dave.context.close();
  await expect(bell(page, 1)).toBeHidden();
  await page.clock.runFor(POLL_MS);
  await expect(bell(page, 1)).toBeVisible();
});
