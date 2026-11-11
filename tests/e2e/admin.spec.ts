import en from "@/messages/en.json";
import { seedChapterReport, seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("admin") });

// The log is the select's "other" case.
const tab = (name: string) =>
  name === "log"
    ? "Log"
    : en.admin.tab.match(new RegExp(`${name} \\{([^}]+)\\}`))![1];

test("only the admin has the panel and its sidebar entry", async ({
  page,
  browser,
}) => {
  await page.goto("/en/stories");
  await expect(
    page.getByRole("link", { name: en.sidebar.admin, exact: true }),
  ).toBeVisible();

  const dave = await browser.newContext({
    storageState: storageStatePath("dave"),
  });
  const davePage = await dave.newPage();
  expect((await davePage.goto("/en/admin"))!.status()).toBe(404);
  await davePage.goto("/en/stories");
  await expect(
    davePage.getByRole("link", { name: en.sidebar.admin, exact: true }),
  ).toHaveCount(0);
  await dave.close();
});

test("resolves Dave's report, bans Erin and marks Alice's chapter as 18+", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  await seedPublished("erin", "Erin book", [
    { title: "Spam", publication: "public", content: "Spam text" },
  ]);
  await seedChapterReport("dave", "One");

  await page.goto("/en/admin");
  const reports = page.getByRole("list", { name: en.moderation.reportList });
  await expect(reports.getByText("Reported chapter by Alice")).toBeVisible();
  await expect(reports.getByText(/Reported by Dave on/)).toBeVisible();
  await reports
    .getByRole("button", { name: /^Resolve the report from/ })
    .click();
  await expect(page.getByText(en.moderation.noReports)).toBeVisible();

  await page
    .getByRole("navigation", { name: en.admin.tabs })
    .getByRole("link", { name: tab("bans") })
    .click();
  const form = page.getByRole("form", { name: en.admin.banTitle });
  await form.getByLabel(en.moderation.nickname).fill("Erin");
  await form.getByLabel(en.moderation.banReason).fill("Spam everywhere");
  await form.getByRole("button", { name: en.admin.ban }).click();
  const bans = page.getByRole("list", { name: en.admin.banList });
  await expect(bans.getByText("Spam everywhere")).toBeVisible();

  const dave = await browser.newContext({
    storageState: storageStatePath("dave"),
  });
  const davePage = await dave.newPage();
  expect((await davePage.goto("/en/p/Erin/erin-book"))!.status()).toBe(404);
  await dave.close();

  await page
    .getByRole("navigation", { name: en.admin.tabs })
    .getByRole("link", { name: tab("adult") })
    .click();
  await page.getByLabel(en.admin.address).fill("/en/p/Alice/book/one");
  await page.getByRole("button", { name: en.admin.find }).click();
  await expect(
    page.getByRole("heading", { name: "Chapter “One”" }),
  ).toBeVisible();
  await page.getByRole("button", { name: en.admin.markAdult }).click();
  await expect(page.getByText("Admin's mark: 18+, locked")).toBeVisible();

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.goto("/en/p/Alice/book/one");
  await expect(
    guestPage.getByRole("heading", { name: en.adult.gateTitle }),
  ).toBeVisible();
  await guest.close();

  await page
    .getByRole("navigation", { name: en.admin.tabs })
    .getByRole("link", { name: tab("log") })
    .click();
  const log = page.getByRole("list", { name: en.moderation.logList });
  await expect(log.getByText("Admin marked a chapter by Alice as 18+")).toBeVisible();
  await expect(log.getByText("Admin banned Erin")).toBeVisible();
  await expect(log.getByText("Admin resolved a report about Alice")).toBeVisible();
});

test("fits a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const name of ["reports", "bans", "adult", "categories", "tags", "log"]) {
    await page.goto(`/en/admin?tab=${name}`);
    await expect(page.getByRole("heading", { name: en.admin.title })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
