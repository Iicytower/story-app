import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedFollow, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, publishFromEditor, test } from "./helpers";

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.use({ storageState: storageStatePath("dave") });

test("a follower sees the author's new chapter in the feed, others do not", async ({
  page,
  browser,
}) => {
  await seedFollow("dave", "alice");
  const title = "A chapter title long enough to wrap on a narrow screen";
  const story = await seedStory("alice", {
    title,
    folder: "Book with a rather long name for the feed",
    content: "Text",
  });

  await page.goto("/en/feed");
  await expect(page).toHaveTitle(en.metadata.feed);
  await expect(page.getByText(en.feed.emptyLink)).toBeVisible();

  const alice = await loginAs(browser, "alice");
  await alice.page.goto(`/chapters/${story}`);
  await publishFromEditor(alice.page);
  await alice.context.close();

  await page.reload();
  const entries = page.getByRole("list", { name: en.feed.entries });
  await expect(entries.getByRole("listitem")).toHaveCount(1);
  await expect(entries.getByRole("link", { name: "Alice" })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);
  await entries.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const erin = await loginAs(browser, "erin");
  await erin.page.goto("/en/feed");
  await expect(
    erin.page.getByRole("list", { name: en.feed.entries }),
  ).toHaveCount(0);
  await erin.page.getByRole("link", { name: en.feed.emptyLink }).click();
  await expect(erin.page).toHaveURL("/en");
  await erin.context.close();
});

test("the sidebar links to the feed", async ({ page }) => {
  await page.goto("/en/feed");
  const link = page.getByRole("link", { name: en.sidebar.feed });
  await expect(link).toBeVisible();
  await expect(
    page.getByRole("heading", { name: en.feed.title }),
  ).toBeVisible();
});
