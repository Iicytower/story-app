import type { Locator, Page } from "@playwright/test";
import { clearSettings, findStoryFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

// Bob, so the collapsed sidebar does not leak into tests that sign Alice in.
test.use({
  storageState: storageStatePath("bob"),
  viewport: { width: 1280, height: 800 },
});
test.afterEach(() => clearSettings("bob"));

// A text array: the previous tooltip may still be fading out.
const tooltip = (page: Page) => page.getByRole("tooltip");

async function seedChapter() {
  const id = await seedStory("bob", { title: "Dragon tale", folder: "Saga" });
  return { id, folderId: (await findStoryFolder("Dragon tale"))! };
}

// Keyboard focus, which is what shows a tooltip without a mouse.
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Tab never reached the target");
}

async function expectNoTooltip(page: Page) {
  // Longer than the tooltip delay.
  await page.waitForTimeout(600);
  await expect(tooltip(page)).toHaveCount(0);
}

test("the chapter row ⋮ and publication icon show their name on hover and on keyboard focus", async ({
  page,
}) => {
  const { folderId } = await seedChapter();
  await page.goto(`/books/${folderId}`);
  const menu = page.getByRole("button", { name: "Actions for Dragon tale" });
  const status = page
    .getByRole("list", { name: "Chapters" })
    .getByRole("img", { name: "Not public" });
  await expect(menu).not.toHaveAttribute("title");

  await menu.hover();
  await expect(tooltip(page)).toHaveText(["Actions for Dragon tale"]);
  await status.hover();
  await expect(tooltip(page)).toHaveText(["Not public"]);

  await page.mouse.move(0, 400);
  await expect(tooltip(page)).toHaveCount(0);
  await tabTo(page, menu);
  await expect(tooltip(page)).toHaveText(["Actions for Dragon tale"]);
});

test("menu items have a visible label and no tooltip", async ({ page }) => {
  const { folderId } = await seedChapter();
  await page.goto(`/books/${folderId}`);
  await page.getByRole("button", { name: "Actions for Dragon tale" }).click();
  const tags = page.getByRole("menuitem", { name: "Tags", exact: true });
  await expect(tags).toBeVisible();
  await page.mouse.move(0, 400);
  await tags.hover();
  await expectNoTooltip(page);
});

test("closing a dialog opened from the menu leaves the page usable and shows no tooltip", async ({
  page,
}) => {
  const { folderId } = await seedChapter();
  await page.goto(`/books/${folderId}`);
  const menu = page.getByRole("button", { name: "Actions for Dragon tale" });
  await menu.click();
  await page.getByRole("menuitem", { name: "Tags", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tags for Dragon tale" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.mouse.move(0, 400);
  await expectNoTooltip(page);

  await menu.click();
  await page.getByRole("menuitem", { name: "Move to…" }).click();
  await expect(page.getByRole("dialog", { name: "Move to…" })).toBeVisible();
});

test("the editor toolbar shows Bold as a tooltip", async ({ page }) => {
  const { id } = await seedChapter();
  await page.goto(`/chapters/${id}`);
  const bold = markdownEditor(page, "Content").button("Bold");
  await expect(bold).not.toHaveAttribute("title");
  await bold.hover();
  await expect(tooltip(page)).toHaveText(["Bold"]);
});

test("the collapsed sidebar shows tooltips, the expanded one does not", async ({
  page,
}) => {
  await page.goto("/books");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("button", { name: "Settings" }).hover();
  await expectNoTooltip(page);

  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  const settings = nav.getByRole("button", { name: "Settings" });
  await expect(settings).not.toHaveAttribute("title");
  await settings.hover();
  await expect(tooltip(page)).toHaveText(["Settings"]);
  await nav.getByRole("button", { name: "Expand sidebar" }).hover();
  await expect(tooltip(page)).toHaveText(["Expand sidebar"]);
});

test("tooltips and menu items are in Polish on /pl", async ({ page }) => {
  const { folderId } = await seedChapter();
  await page.goto(`/pl/books/${folderId}`);
  const menu = page.getByRole("button", { name: "Akcje: Dragon tale" });
  await menu.hover();
  await expect(tooltip(page)).toHaveText(["Akcje: Dragon tale"]);
  await menu.click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Tagi",
    "Przenieś do…",
    "Opublikuj",
    "Oznacz jako 18+",
    "Usuń",
  ]);
});
