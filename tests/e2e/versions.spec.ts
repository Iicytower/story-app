import type { Page } from "@playwright/test";
import {
  findFolder,
  findFolderVersion,
  findStoryById,
  seedStory,
  updateStoryById,
} from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

async function seedBook(...titles: string[]) {
  const ids: string[] = [];
  for (const title of titles) {
    ids.push(
      await seedStory("alice", {
        title,
        folder: "Book",
        content: `${title} content`,
      }),
    );
  }
  const folder = await findFolder("Book");
  return { folderId: folder!._id.toString(), ids };
}

async function saveVersion(page: Page, name: string) {
  await page.getByRole("button", { name: "Save version" }).click();
  const dialog = page.getByRole("dialog", { name: "Save version" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

const versions = (page: Page) => page.getByRole("list", { name: "Versions" });

function versionChapter(page: Page, title: string) {
  return page
    .getByRole("list", { name: "Chapters in this version" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: title, exact: true }) });
}

test("saves a named version, compares it and restores one, then two chapters", async ({
  page,
}) => {
  const {
    folderId,
    ids: [a, b, c],
  } = await seedBook("A", "B", "C");
  await page.goto(`/folders/${folderId}`);

  await page.getByRole("button", { name: "Save version" }).click();
  const dialog = page.getByRole("dialog", { name: "Save version" });
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await dialog.getByLabel("Name").fill("   ");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await dialog.getByLabel("Name").fill("First draft");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(versions(page)).toContainText("Version 1: First draft");
  await expect(versions(page)).toContainText("3 chapters");
  expect(await findFolderVersion(1)).toMatchObject({ name: "First draft" });

  await updateStoryById(a, { content: "A rewritten" });
  await updateStoryById(b, { content: "B rewritten" });
  await updateStoryById(c, { deletedAt: new Date() });

  await versions(page)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Version 1: First draft" }),
  ).toBeVisible();
  const status = (title: string, text: string) =>
    versionChapter(page, title).getByText(text, { exact: true });
  await expect(status("A", "changed")).toBeVisible();
  await expect(status("B", "changed")).toBeVisible();
  await expect(status("C", "deleted since")).toBeVisible();
  await versionChapter(page, "A").getByText("Show changes").click();
  await expect(versionChapter(page, "A").locator("del")).toHaveText("content");
  await expect(versionChapter(page, "A").locator("ins")).toHaveText(
    "rewritten",
  );

  const folderUrl = `/folders/${folderId}`;
  const restore = page.getByRole("button", { name: "Restore selected" });
  await expect(restore).toBeDisabled();
  await page.getByRole("checkbox", { name: "A", exact: true }).check();
  await restore.click();
  await expect(page).toHaveURL(folderUrl);
  await expect(versions(page).getByRole("link")).toHaveText([
    /Version 2: Before restoring version 1/,
    /Version 1: First draft/,
  ]);
  expect((await findStoryById(a))?.content).toBe("A content");
  expect((await findStoryById(b))?.content).toBe("B rewritten");

  await versions(page)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await expect(status("A", "unchanged")).toBeVisible();
  await page.getByRole("checkbox", { name: "B", exact: true }).check();
  await page.getByRole("checkbox", { name: "C", exact: true }).check();
  await restore.click();
  await expect(page).toHaveURL(folderUrl);
  await expect(
    page.getByRole("list", { name: "Chapters" }).getByRole("listitem"),
  ).toHaveCount(3);
  expect(await findStoryById(b)).toMatchObject({ content: "B content" });
  expect(await findStoryById(c)).toMatchObject({
    content: "C content",
    deletedAt: null,
  });
  await expect(versions(page).getByRole("link")).toHaveText([
    /Version 3: Before restoring version 1/,
    /Version 2: Before restoring version 1/,
    /Version 1: First draft/,
  ]);
});

test("selects all chapters with one checkbox", async ({ page }) => {
  const { folderId, ids } = await seedBook("A", "B");
  await page.goto(`/folders/${folderId}`);
  await saveVersion(page, "Both");
  for (const id of ids) await updateStoryById(id, { content: "edited" });

  await versions(page)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await page.getByRole("checkbox", { name: "Select all" }).check();
  await expect(
    page.getByRole("checkbox", { name: "A", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Restore selected" }).click();

  await expect(page).toHaveURL(`/folders/${folderId}`);
  for (const [i, id] of ids.entries()) {
    expect((await findStoryById(id))?.content).toBe(`${"AB"[i]} content`);
  }
});

test("an open editor gets a conflict after its chapter is restored", async ({
  page,
  context,
}) => {
  const {
    folderId,
    ids: [a],
  } = await seedBook("A");
  await page.goto(`/stories/${a}`);
  const content = page.getByRole("textbox", { name: "Content", exact: true });
  await expect(content).toBeVisible();

  const other = await context.newPage();
  await other.goto(`/folders/${folderId}`);
  await saveVersion(other, "Before edits");
  // Saved meanwhile without the open editor knowing (it keeps its updatedAt).
  await updateStoryById(a, { content: "Edited elsewhere" });
  await versions(other)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await other.getByRole("checkbox", { name: "A", exact: true }).check();
  await other.getByRole("button", { name: "Restore selected" }).click();
  await expect(other).toHaveURL(`/folders/${folderId}`);

  await content.fill("Typed in the open editor");
  await page.keyboard.press("Control+s");

  await expect(page.getByRole("status")).toHaveText(
    /changed in another tab or on another device/,
  );
  expect((await findStoryById(a))?.content).toBe("A content");
});

test("restores the entire version after confirmation, removing chapters added since", async ({
  page,
}) => {
  const {
    folderId,
    ids: [a],
  } = await seedBook("A", "B");
  await page.goto(`/folders/${folderId}`);
  await saveVersion(page, "Two chapters");
  await updateStoryById(a, { content: "A rewritten", notes: "A notes" });
  const added = await seedStory("alice", { title: "C", folder: "Book" });

  await versions(page)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await expect(
    versionChapter(page, "C").getByText("added since", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore entire version" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Restore entire version?",
  });
  await expect(dialog.getByRole("listitem")).toHaveText([
    "1 chapter will be reverted.",
    "1 chapter added since will be removed.",
    "The chapter order and sort mode will be restored.",
  ]);
  await dialog.getByRole("button", { name: "Restore" }).click();

  await expect(page).toHaveURL(`/folders/${folderId}`);
  await expect(
    page.getByRole("list", { name: "Chapters" }).getByRole("link"),
  ).toHaveText([/^B/, /^A/]);
  expect(await findStoryById(a)).toMatchObject({
    content: "A content",
    notes: "A notes",
  });
  expect((await findStoryById(added))?.deletedAt).toBeInstanceOf(Date);
  await expect(versions(page).getByRole("link").first()).toHaveText(
    /Version 2: Before restoring version 1/,
  );
});

test("removes a selected chapter added since", async ({ page }) => {
  const { folderId } = await seedBook("A");
  await page.goto(`/folders/${folderId}`);
  await saveVersion(page, "One chapter");
  const added = await seedStory("alice", { title: "New", folder: "Book" });

  await versions(page)
    .getByRole("link", { name: /Version 1/ })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "A", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "New", exact: true }).check();
  await expect(
    versionChapter(page, "New").getByText("will be removed"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore selected" }).click();

  await expect(page).toHaveURL(`/folders/${folderId}`);
  expect((await findStoryById(added))?.deletedAt).toBeInstanceOf(Date);
});

test("deletes a version after confirmation", async ({ page }) => {
  const { folderId } = await seedBook("A");
  await page.goto(`/folders/${folderId}`);
  await saveVersion(page, "Old");
  await saveVersion(page, "New");

  await page.getByRole("button", { name: "Delete Version 1" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete version?" });
  await expect(dialog).toContainText("Version 1 “Old” will be removed.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(versions(page).getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Delete Version 1" }).click();
  await dialog.getByRole("button", { name: "Delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(versions(page).getByRole("link")).toHaveText([/Version 2: New/]);
  expect(await findFolderVersion(1)).toBeNull();
  expect(await findFolderVersion(2)).toMatchObject({ name: "New" });
});
