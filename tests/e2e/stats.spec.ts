import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedDailyStats, seedPublished, sumDailyReaders } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const CHAPTER = "/en/p/Alice/book/one";

const chapterRow = (page: Page, title: string) =>
  page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: title, exact: true }),
  });

test("dave and erin read alice's chapter; alice sees them in the chart and the table", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
    { title: "Two", publication: "public", content: "More text" },
    { title: "Three", publication: "hidden", content: "Withdrawn" },
  ]);
  // A withdrawn chapter's readers stay out of the chart and the table.
  await seedDailyStats("alice", "Book", "Three", [{ daysAgo: 2, readers: 9 }]);
  // Five earlier days with readers of the other chapter, plus today's reads: six bars.
  await seedDailyStats(
    "alice",
    "Book",
    "Two",
    [1, 2, 3, 4, 5].map((daysAgo) => ({ daysAgo, readers: 1 })),
  );

  for (const reader of ["dave", "erin"] as const) {
    const { context, page: readerPage } = await loginAs(browser, reader);
    await readerPage.goto(CHAPTER);
    await expect(readerPage.getByText("Chapter text")).toBeVisible();
    // Again the same day: still one reader.
    await readerPage.reload();
    await expect(readerPage.getByText("Chapter text")).toBeVisible();
    await context.close();
  }
  // Neither the author nor a guest without a trusted address counts.
  await page.goto(CHAPTER);
  await expect(page.getByText("Chapter text")).toBeVisible();
  const guest = await browser.newContext({ storageState: undefined });
  const guestPage = await guest.newPage();
  await guestPage.goto(CHAPTER);
  await expect(guestPage.getByText("Chapter text")).toBeVisible();
  await guest.close();
  await expect.poll(sumDailyReaders).toBe(16);

  await page.goto("/en");
  await page.getByRole("link", { name: en.sidebar.stats }).click();
  await expect(page).toHaveURL("/en/stats");
  await page.getByRole("link", { name: "7 days" }).click();
  await expect(page).toHaveURL("/en/stats?range=7");
  await expect(page.getByTestId("stats-chart")).toHaveAttribute(
    "data-points",
    "6",
  );
  await expect(page.getByText("7 readers in this period")).toBeVisible();
  await expect(page.getByTestId("stats-chart")).toHaveAccessibleName(
    "Chart of unique readers per day over the last 7 days: 7 readers in total",
  );
  await expect(page.getByRole("rowheader", { name: "Three" })).toHaveCount(0);
  await expect(chapterRow(page, "One").getByRole("cell").first()).toHaveText(
    "2",
  );
  await expect(chapterRow(page, "Two").getByRole("cell").first()).toHaveText(
    "5",
  );
  await expect(chapterRow(page, "Book").getByRole("cell").first()).toHaveText(
    "7",
  );
});

test("an account without a publication has no statistics", async ({
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  const { context, page } = await loginAs(browser, "bob");
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: en.sidebar.folders }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: en.sidebar.stats })).toHaveCount(
    0,
  );
  const response = await page.goto("/en/stats");
  expect(response?.status()).toBe(404);
  await context.close();
});

test("on a narrow screen the table scrolls in its box, not the page", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/en/stats");
  await expect(chapterRow(page, "One")).toBeVisible();
  const widths = await page.evaluate(() => {
    const box = document.querySelector("table")!.parentElement!;
    return {
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      box: box.scrollWidth,
      boxVisible: box.clientWidth,
    };
  });
  expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  expect(widths.box).toBeGreaterThan(widths.boxVisible);
  await expect(page.getByText(en.stats.tableScrollHint)).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByText(en.stats.tableScrollHint)).toBeHidden();
});

test("the chart keeps its height from the first paint", async ({
  browser,
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  await seedDailyStats("alice", "Book", "One", [{ daysAgo: 1, readers: 3 }]);

  // Before hydration (no JavaScript) the chart's place is held by a placeholder.
  const noScript = await browser.newContext({
    storageState: storageStatePath("alice"),
    javaScriptEnabled: false,
  });
  const before = await noScript.newPage();
  await before.goto("/en/stats");
  const placeholder = before.getByTestId("stats-chart-placeholder");
  await expect(placeholder).toBeAttached();
  const placeholderBox = await placeholder.boundingBox();
  await noScript.close();

  await page.goto("/en/stats");
  const chart = page.getByTestId("stats-chart");
  await expect(chart).toHaveAttribute("data-points", "1");
  await expect(page.getByTestId("stats-chart-placeholder")).toHaveCount(0);
  await expect(chart.locator(".recharts-bar-rectangle").first()).toBeVisible();
  const chartBox = await chart.boundingBox();
  expect(placeholderBox?.height).toBe(256);
  expect(chartBox?.height).toBe(placeholderBox?.height);
});
