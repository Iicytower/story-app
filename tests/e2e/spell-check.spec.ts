import type { Locator } from "@playwright/test";
import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

// The squiggles themselves are drawn by the browser and checked manually.
async function expectPolish(field: Locator) {
  await expect(field).toHaveAttribute("lang", "pl");
  await expect(field).toHaveAttribute("spellcheck", "true");
}

test("story text fields are spell checked in Polish", async ({ page }) => {
  const id = await seedStory("alice", { title: "Pisownia", folder: "Book" });
  await page.goto(`/stories/${id}`);

  await expectPolish(page.getByRole("textbox", { name: "Title" }));
  for (const label of ["Content", "Notes", "Folder notes"]) {
    const editor = markdownEditor(page, label);
    await expectPolish(editor.field);
    await editor.button("Source").click();
    await expectPolish(editor.group.getByRole("textbox"));
    await editor.button("Preview").click();
  }

  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Chapters" })
    .click();
  await page.getByRole("button", { name: "New chapter" }).click();
  const chapter = page.getByRole("dialog", { name: "New chapter" });
  await expectPolish(chapter.getByLabel("Title"));
  await chapter.getByRole("button", { name: "Cancel" }).click();

  await page.goto(`/folders/${await seedFolder("alice", "Book")}`);
  await expectPolish(markdownEditor(page, "Folder notes").field);

  await page.goto("/stories");
  await page.getByRole("button", { name: "New story" }).click();
  const story = page.getByRole("dialog", { name: "New story" });
  await expectPolish(story.getByLabel("Title"));
  await expect(story.getByLabel("Folder")).not.toHaveAttribute("lang", "pl");
});

test("the rest of the UI is not marked as Polish", async ({ page }) => {
  const id = await seedStory("alice", { title: "UI" });
  await page.goto(`/stories/${id}`);

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    markdownEditor(page, "Content").button("Bold"),
  ).not.toHaveAttribute("lang", "pl");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Share link" }),
  ).not.toHaveAttribute("lang", "pl");
  const polish = page.locator('[lang="pl"]');
  await expect(polish).toHaveCount(4);
  expect(
    await polish.evaluateAll((fields) =>
      fields.map((field) => field.getAttribute("aria-label")),
    ),
  ).toEqual(["Title", "Content", "Folder notes", "Notes"]);
});
