import type { Browser, Page } from "@playwright/test";
import { findFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, openMenu, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const BADGE = "For adults only (18+)";

async function confirm(page: Page, dialog: string, button: string) {
  await page
    .getByRole("alertdialog", { name: dialog })
    .getByRole("button", { name: button, exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

async function anonymous(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  return context.newPage();
}

async function seedBook() {
  await seedStory("alice", {
    title: "Night",
    folder: "Dark",
    content: "Moonlit text",
  });
  return (await findFolder("Dark"))!._id.toString();
}

const chapterRow = (page: Page) =>
  page.getByRole("listitem").filter({ hasText: "Night" });

test("the owner marks a chapter and a folder as 18+ and removes the marks", async ({
  page,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await expect(page.getByRole("img", { name: BADGE })).toHaveCount(0);

  await menuAction(page, "Actions for Night", "Mark as 18+", chapterRow(page));
  await confirm(page, "Mark chapter as 18+?", "Mark as 18+");
  await expect(
    chapterRow(page).getByRole("img", { name: BADGE }),
  ).toBeVisible();

  await menuAction(page, "Actions for Dark", "Mark as 18+");
  await confirm(page, "Mark folder as 18+?", "Mark as 18+");
  await expect(page.getByRole("img", { name: BADGE })).toHaveCount(2);

  // The chapter is 18+ through the folder now, so its own switch is locked.
  await openMenu(
    chapterRow(page).getByRole("button", { name: "Actions for Night" }),
  );
  const locked = page.getByRole("menuitem", { name: /Remove 18\+/ });
  await expect(locked).toBeDisabled();
  await expect(locked).toContainText("Locked: the folder is 18+");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await menuAction(page, "Actions for Dark", "Remove 18+");
  await confirm(page, "Remove 18+ from folder?", "Remove 18+");
  await menuAction(page, "Actions for Night", "Remove 18+", chapterRow(page));
  await confirm(page, "Remove 18+ from chapter?", "Remove 18+");
  await expect(page.getByRole("img", { name: BADGE })).toHaveCount(0);
});

test("readers see the badge in search and a warning before reading", async ({
  page,
  browser,
}) => {
  const id = await seedBook();
  await page.goto(`/folders/${id}`);
  await menuAction(page, "Actions for Dark", "Publish");
  await confirm(page, "Publish folder?", "Publish");
  await menuAction(page, "Actions for Dark", "Mark as 18+");
  await confirm(page, "Mark folder as 18+?", "Mark as 18+");

  const visitor = await anonymous(browser);
  await visitor.goto("/");
  const field = visitor.getByRole("searchbox", {
    name: "Search published stories",
  });
  await field.fill("Moonlit");
  await field.press("Enter");
  const result = visitor
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem");
  await expect(result.getByRole("img", { name: BADGE })).toBeVisible();

  await result.getByRole("link").click();
  await expect(
    visitor.getByRole("heading", { name: "Content for adults" }),
  ).toBeVisible();
  await expect(visitor.getByText("Moonlit text")).toHaveCount(0);
  await visitor.getByRole("button", { name: "I am 18 or older" }).click();
  await expect(visitor.getByText("Moonlit text")).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByText("Moonlit text")).toBeVisible();
});
