import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, openMenu, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";
// The menu's name ends with the comment's date.
const menuFor = (nickname: string) =>
  new RegExp(
    `^${en.comments.menuFor.replace("{nickname}", nickname).replace("{date}", "")}`,
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

test("a guest clicking Report gets the sign-in dialog", async ({ browser }) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await erin.page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Guests can read this");
  await erin.page.getByRole("button", { name: en.comments.submit }).click();
  await expect(erin.page.getByText("Guests can read this")).toBeVisible();
  await erin.context.close();

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await guest.newPage();
  await page.goto(CHAPTER);
  const signIn = page.getByRole("dialog", { name: en.auth.signIn });

  const reportChapter = page.getByRole("button", {
    name: en.reports.reportChapter,
  });
  await reportChapter.click();
  await expect(signIn).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reportChapter).toBeFocused();

  const menu = page.getByRole("button", { name: menuFor("Erin") });
  await openMenu(menu);
  await page
    .getByRole("menuitem", { name: en.reports.report, exact: true })
    .click();
  await expect(signIn).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/en/p/Alice/book");
  await page.getByRole("button", { name: en.reports.reportBook }).click();
  await expect(signIn).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/en/p/Alice");
  await page
    .getByRole("button", {
      name: en.reports.reportProfile.replace("{nickname}", "Alice"),
    })
    .click();
  await expect(signIn).toBeVisible();
  await guest.close();
});

test("dave reports erin's comment under alice's text and alice resolves it", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await erin.page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Buy cheap stuff");
  await erin.page.getByRole("button", { name: en.comments.submit }).click();
  await expect(erin.page.getByText("Buy cheap stuff")).toBeVisible();
  // No Report on one's own comment.
  await expect(
    erin.page.getByRole("button", { name: menuFor("Erin") }),
  ).toHaveCount(0);
  await erin.context.close();

  await page.goto(CHAPTER);
  const menu = page.getByRole("button", { name: menuFor("Erin") });
  await openMenu(menu);
  await page
    .getByRole("menuitem", { name: en.reports.report, exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Report comment" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("combobox", { name: en.reports.reason })
    .selectOption({ label: "Harassment" });
  await dialog
    .getByRole("textbox", { name: en.reports.details })
    .fill("Spam links everywhere");
  await page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(page);
  await dialog.getByRole("button", { name: en.reports.send }).click();
  await expect(dialog.getByText(en.reports.sent)).toBeVisible();
  await dialog.getByRole("button", { name: en.common.close }).first().click();
  await expect(menu).toBeFocused();

  // The same comment again is refused while the report is open.
  await openMenu(menu);
  await page
    .getByRole("menuitem", { name: en.reports.report, exact: true })
    .click();
  const reason = dialog.getByRole("combobox", { name: en.reports.reason });
  await expect(reason).toHaveValue("");
  await reason.selectOption({ label: "Spam" });
  await dialog.getByRole("button", { name: en.reports.send }).click();
  await expect(dialog.getByText(en.errors.reportAlreadyOpen)).toBeVisible();
  await page.keyboard.press("Escape");

  const alice = await loginAs(browser, "alice");
  await alice.page.goto("/en/moderation");
  await alice.page.getByRole("link", { name: tab("reports") }).click();
  const reports = alice.page.getByRole("list", {
    name: en.moderation.reportList,
  });
  await expect(reports.getByText("Reported comment: Erin")).toBeVisible();
  await expect(reports.getByText("Buy cheap stuff")).toBeVisible();
  await expect(reports.getByText("Reason: harassment")).toBeVisible();
  await expect(
    reports.getByText("Details: Spam links everywhere"),
  ).toBeVisible();
  // The community does not learn who reported.
  await expect(reports.getByText("Dave")).toHaveCount(0);
  await alice.page.setViewportSize({ width: 375, height: 800 });
  await expectNoHorizontalScroll(alice.page);
  await reports
    .getByRole("button", {
      name: new RegExp(`^${en.moderation.resolveFor.replace("{date}", "")}`),
    })
    .click();
  await expect(alice.page.getByText(en.moderation.noReports)).toBeVisible();

  await alice.page.getByRole("link", { name: tab("other") }).click();
  const log = alice.page.getByRole("list", { name: en.moderation.logList });
  await expect(
    log.getByText("Alice resolved a report about Erin"),
  ).toBeVisible();
  await alice.context.close();
});
