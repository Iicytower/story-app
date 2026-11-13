import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const bell = (page: Page, unread = 0) =>
  page.getByRole("button", {
    name:
      unread > 0 ? `Notifications, ${unread} unread` : en.sidebar.notifications,
    exact: true,
  });

async function startThread(page: Page, title: string, body: string) {
  // The form stays hidden until "New thread" is clicked (task 103).
  await expect(page.getByLabel(en.forums.threadTitle)).toHaveCount(0);
  await page.getByRole("button", { name: en.forums.newThread }).click();
  await expect(page.getByLabel(en.forums.threadTitle)).toBeFocused();
  await page.getByLabel(en.forums.threadTitle).fill(title);
  await page.getByRole("textbox", { name: en.forums.threadBody }).fill(body);
  await page.getByRole("button", { name: en.forums.submitThread }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("dave starts a thread in the workshop, erin quotes it and dave is notified", async ({
  page,
  browser,
}) => {
  const workshop = (page: Page) =>
    page
      .getByRole("list", { name: en.forums.categories })
      .getByRole("listitem")
      .filter({ hasText: "Writing workshop" });
  await page.goto("/en/forums");
  await expect(workshop(page)).toContainText("No threads");
  await page.getByRole("link", { name: "Writing workshop" }).click();
  await expect(page).toHaveURL(/\/en\/forums\/workshop$/);
  // Cancel closes the form and gives the focus back to "New thread".
  await page.getByRole("button", { name: en.forums.newThread }).click();
  await page.getByRole("button", { name: en.common.cancel }).click();
  await expect(
    page.getByRole("button", { name: en.forums.newThread }),
  ).toBeFocused();
  await startThread(page, "Pacing help", "How do I fix **pacing**?");
  await expect(page).toHaveURL(/\/en\/forums\/t\/[0-9a-f]{24}$/);
  const threadUrl = page.url();
  await page.goto("/en/forums");
  await expect(workshop(page)).toContainText(
    /1 thread · last post (now|\d+ minutes? ago)/,
  );
  await page.goto(threadUrl);
  await expect(
    page.getByRole("button", { name: en.forums.unfollow }),
  ).toBeVisible();

  const erin = await loginAs(browser, "erin");
  await erin.page.goto(threadUrl);
  await erin.page.getByRole("button", { name: "Quote Dave" }).click();
  await erin.page
    .getByRole("textbox", { name: "Quote Dave" })
    .fill("Try shorter chapters");
  await erin.page
    .getByRole("button", { name: en.forums.submitPost, exact: true })
    .first()
    .click();
  const posts = erin.page.getByRole("list", { name: en.forums.postList });
  await expect(posts.getByRole("listitem")).toHaveCount(2);
  await expect(posts.getByText("Try shorter chapters")).toBeVisible();
  await expect(posts.getByText("Quoting Dave")).toBeVisible();
  await erin.context.close();

  await page.goto("/en/books");
  await bell(page, 1).click();
  const item = page
    .getByRole("dialog", { name: en.notifications.title })
    .getByRole("button", { name: /Erin quoted your post in “Pacing help”/ });
  await item.click();
  await expect(page).toHaveURL(
    /\/en\/forums\/t\/[0-9a-f]{24}#post-[0-9a-f]{24}$/,
  );
  await expect(page.getByText("Try shorter chapters")).toBeVisible();
});

test("alice's forum: dave writes, a guest reads and is asked to log in", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  await page.goto("/en/p/Alice/forum");
  await expect(
    page.getByRole("heading", { name: "Forum of Alice" }),
  ).toBeVisible();
  await startThread(page, "Hello Alice", "Loved the first chapter.");
  await expect(page).toHaveURL(/\/en\/p\/Alice\/forum\/[0-9a-f]{24}$/);

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.setViewportSize({ width: 375, height: 800 });
  await guestPage.goto("/en/p/Alice/forum");
  await guestPage.getByRole("link", { name: "Hello Alice" }).click();
  await expect(guestPage.getByText("Loved the first chapter.")).toBeVisible();
  await expect(
    guestPage.getByRole("textbox", { name: en.forums.newPost }),
  ).toBeHidden();
  await guestPage.getByRole("button", { name: en.forums.signIn }).click();
  await expect(guestPage.getByRole("dialog")).toBeVisible();
  expect(
    await guestPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Without a public book there is no forum.
  const missing = await guestPage.goto("/en/p/Erin/forum");
  expect(missing?.status()).toBe(404);
  await guest.close();
});
