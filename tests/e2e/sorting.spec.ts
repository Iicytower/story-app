import type { Locator, Page } from "@playwright/test";
import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, openMenu, sortBy, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

async function expectSort(page: Page, menu: string, option: string) {
  await openMenu(page.getByRole("button", { name: menu, exact: true }));
  await page.getByRole("menuitem", { name: "Sort", exact: true }).hover();
  await expect(
    page.getByRole("menuitemradio", { name: option, exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}

// Space picks the row up, each arrow moves it one place, Space drops it.
async function dragWithKeyboard(handle: Locator, key: string, times: number) {
  await handle.focus();
  await handle.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < times; i++) {
    await handle.press(key);
    // Each step animates; the next one is measured from where the row ends up.
    await handle.page().waitForTimeout(250);
  }
  await handle.press("Space");
  await expect(handle).not.toHaveAttribute("aria-pressed", "true");
}

async function dragWithMouse(page: Page, handle: Locator, target: Locator) {
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
}

test("switches folder sort modes and drags a folder in manual mode", async ({
  page,
}) => {
  await seedFolder("alice", "banana", new Date("2026-01-03"));
  await seedFolder("alice", "Apple", new Date("2026-01-01"));
  await seedFolder("alice", "cherry", new Date("2026-01-02"));

  await page.goto("/books");
  const folders = page.getByRole("list", { name: "Books" });
  const names = folders.getByRole("listitem").locator("a > span > span:first-child");
  await expectSort(page, "Actions for all books", "Last updated");
  await expect(names).toHaveText(["banana", "cherry", "Apple"]);
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);

  await sortBy(page, "Actions for all books", "A–Z");
  await expect(names).toHaveText(["Apple", "banana", "cherry"]);

  await sortBy(page, "Actions for all books", "Manual");
  await expect(names).toHaveText(["Apple", "banana", "cherry"]);
  await dragWithKeyboard(
    page.getByRole("button", { name: "Move cherry" }),
    "ArrowUp",
    1,
  );
  await expect(names).toHaveText(["Apple", "cherry", "banana"]);

  await page.reload();
  await expectSort(page, "Actions for all books", "Manual");
  await expect(names).toHaveText(["Apple", "cherry", "banana"]);

  await dragWithMouse(
    page,
    page.getByRole("button", { name: "Move banana" }),
    folders.getByRole("listitem").first(),
  );
  await expect(names).toHaveText(["banana", "Apple", "cherry"]);
  await page.reload();
  await expect(names).toHaveText(["banana", "Apple", "cherry"]);
});

test("switches chapter sort modes and drags a chapter in manual mode", async ({
  page,
}) => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  await seedStory("alice", {
    title: "banana",
    folder: "Book",
    createdAt: day(1),
  });
  await seedStory("alice", {
    title: "Apple",
    folder: "Book",
    createdAt: day(3),
  });
  await seedStory("alice", {
    title: "cherry",
    folder: "Book",
    createdAt: day(2),
  });

  await page.goto("/books");
  await page.getByRole("link", { name: /^Book \d/ }).click();
  // The folder list row has its own "Actions for Book" menu; wait for the folder page.
  await expect(page).toHaveURL(/\/books\//);
  const titles = page
    .getByRole("list", { name: "Chapters" })
    .getByRole("listitem")
    .locator("a > span:first-child");
  await expectSort(page, "Actions for Book", "Oldest first");
  await expect(titles).toHaveText(["banana", "cherry", "Apple"]);
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);

  await sortBy(page, "Actions for Book", "A–Z");
  await expect(titles).toHaveText(["Apple", "banana", "cherry"]);

  await sortBy(page, "Actions for Book", "Manual");
  await expect(titles).toHaveText(["Apple", "banana", "cherry"]);
  await dragWithKeyboard(
    page.getByRole("button", { name: "Move Apple" }),
    "ArrowDown",
    2,
  );
  await expect(titles).toHaveText(["banana", "cherry", "Apple"]);

  await page.reload();
  await expectSort(page, "Actions for Book", "Manual");
  await expect(titles).toHaveText(["banana", "cherry", "Apple"]);
});
