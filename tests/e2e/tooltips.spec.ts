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

test("chapter row buttons show their name on hover and on keyboard focus", async ({
  page,
}) => {
  const { folderId } = await seedChapter();
  await page.goto(`/folders/${folderId}`);
  const tags = page.getByRole("button", { name: "Tags for Dragon tale" });
  const publish = page.getByRole("button", { name: 'Publish "Dragon tale"' });
  await expect(tags).not.toHaveAttribute("title");
  await expect(publish).not.toHaveAttribute("title");

  await tags.hover();
  await expect(tooltip(page)).toHaveText(["Tags for Dragon tale"]);
  await publish.hover();
  await expect(tooltip(page)).toHaveText(['Publish "Dragon tale"']);

  await page.mouse.move(0, 400);
  await expect(tooltip(page)).toHaveCount(0);
  await tabTo(page, tags);
  await expect(tooltip(page)).toHaveText(["Tags for Dragon tale"]);
});

test("a button with a visible label gets no tooltip", async ({ page }) => {
  const { folderId } = await seedChapter();
  await page.goto(`/folders/${folderId}`);
  await page.getByRole("button", { name: "Tags", exact: true }).hover();
  await expectNoTooltip(page);
});

test("closing a dialog with the mouse does not show its trigger's tooltip", async ({
  page,
}) => {
  const { folderId } = await seedChapter();
  await page.goto(`/folders/${folderId}`);
  await page.getByRole("button", { name: "Tags for Dragon tale" }).click();
  const dialog = page.getByRole("dialog", { name: "Tags for Dragon tale" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.mouse.move(0, 400);
  await expectNoTooltip(page);
});

test("the editor toolbar shows Bold as a tooltip", async ({ page }) => {
  const { id } = await seedChapter();
  await page.goto(`/stories/${id}`);
  const bold = markdownEditor(page, "Content").button("Bold");
  await expect(bold).not.toHaveAttribute("title");
  await bold.hover();
  await expect(tooltip(page)).toHaveText(["Bold"]);
});

test("the collapsed sidebar shows tooltips, the expanded one does not", async ({
  page,
}) => {
  await page.goto("/stories");
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

test("tooltips are in Polish on /pl", async ({ page }) => {
  const { folderId } = await seedChapter();
  await page.goto(`/pl/folders/${folderId}`);
  await page.getByRole("button", { name: "Tagi: Dragon tale" }).hover();
  await expect(tooltip(page)).toHaveText(["Tagi: Dragon tale"]);
});
