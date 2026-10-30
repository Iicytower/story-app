import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import type { Page } from "@playwright/test";
import { EXPORT_FORMATS } from "@/lib/export/formats";
import { findFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

async function exportAs(page: Page, id: string, extras = false) {
  await page.getByRole("button", { name: "Export as…" }).click();
  await page.getByLabel("Format").selectOption(id);
  if (extras) await page.getByLabel("Include comments and notes").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  return downloadPromise;
}

for (const { id, extension } of EXPORT_FORMATS) {
  test(`exports a chapter as .${id}`, async ({ page }) => {
    const storyId = await seedStory("alice", {
      title: "Zażółć",
      content: "Tekst",
    });
    await page.goto(`/stories/${storyId}`);
    const download = await exportAs(page, id);
    expect(download.suggestedFilename()).toBe(`zazolc.${extension}`);
    const file = await readFile(await download.path());
    expect(file.length).toBeGreaterThan(0);
    if (id === "pdf") expect(file.toString("latin1")).toMatch(/^%PDF-/);
  });
}

test("saves unsaved changes first and honours the extras switch", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Plain",
    content: "Old",
    notes: "Private note",
  });
  await page.goto(`/stories/${id}`);
  await markdownEditor(page, "Content").setSource("Fresh");

  const clean = await readFile(await (await exportAs(page, "txt")).path());
  expect(clean.toString()).toContain("Fresh");
  expect(clean.toString()).not.toContain("Private note");

  const full = await readFile(await (await exportAs(page, "txt", true)).path());
  expect(full.toString()).toContain("Private note");
});

test("does not export when saving fails", async ({ page }) => {
  await seedStory("alice", { title: "Taken" });
  const id = await seedStory("alice", { title: "Mine" });
  await page.goto(`/stories/${id}`);
  let downloaded = false;
  page.on("download", () => {
    downloaded = true;
  });

  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Taken");
  await page.getByRole("button", { name: "Export as…" }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();

  await expect(page.getByRole("status")).toHaveText(
    "A story with this title already exists in this folder.",
  );
  expect(downloaded).toBe(false);
});

test("exports a folder as one document", async ({ page }) => {
  await seedStory("alice", {
    title: "Rozdział",
    content: "Treść „polska”",
    folder: "Książka",
  });
  const folder = await findFolder("Książka");
  await page.goto(`/folders/${folder!._id}`);

  const download = await exportAs(page, "epub");
  expect(download.suggestedFilename()).toBe("ksiazka.epub");
  const files = unzipSync(await readFile(await download.path()));
  expect(strFromU8(files["OEBPS/chapter-1.xhtml"])).toContain("Treść „polska”");
});
