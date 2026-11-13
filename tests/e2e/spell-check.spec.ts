import type { Locator } from "@playwright/test";
import { seedFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import {
  expect,
  markdownEditor,
  openMenu,
  publicLinkRow,
  publishFromEditor,
  test,
} from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

// The squiggles themselves are drawn by the browser and checked manually.
// Every field takes `lang` from its folder (D58); Polish is the only language so far.
async function expectPolish(field: Locator) {
  await expect(field).toHaveAttribute("lang", "pl");
  await expect(field).toHaveAttribute("spellcheck", "true");
}

test("story text fields are spell checked in Polish", async ({ page }) => {
  const id = await seedStory("alice", { title: "Pisownia", folder: "Book" });
  await page.goto(`/chapters/${id}`);

  await expectPolish(page.getByRole("textbox", { name: "Title" }));
  for (const label of ["Content", "Notes", "Book notes"]) {
    const editor = markdownEditor(page, label);
    await expectPolish(editor.field);
    await editor.mode("Markdown");
    await expectPolish(editor.group.getByRole("textbox"));
    await editor.mode("Text");
  }

  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Chapters" })
    .click();
  await page.getByRole("button", { name: "New chapter" }).click();
  const chapter = page.getByRole("dialog", { name: "New chapter" });
  await expectPolish(chapter.getByLabel("Title"));
  await chapter.getByRole("button", { name: "Cancel" }).click();

  await page.goto(`/books/${await seedFolder("alice", "Book")}`);
  await expectPolish(markdownEditor(page, "Book notes").field);

  await page.goto("/books");
  await page.getByRole("button", { name: "New chapter", exact: true }).click();
  const story = page.getByRole("dialog", { name: "New chapter" });
  await expectPolish(story.getByLabel("Title"));
  await expect(story.getByLabel("Book")).not.toHaveAttribute("lang", "pl");
});

test("the rest of the UI is not marked as Polish", async ({ page }) => {
  const id = await seedStory("alice", { title: "UI" });
  await page.goto(`/chapters/${id}`);

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    markdownEditor(page, "Content").button("Bold"),
  ).not.toHaveAttribute("lang", "pl");
  await publishFromEditor(page);
  await expect(publicLinkRow(page)).toBeVisible();
  const polish = page.locator('[lang="pl"]');
  await expect(polish).toHaveCount(4);
  expect(
    await polish.evaluateAll((fields) =>
      fields.map((field) => field.getAttribute("aria-label")),
    ),
  ).toEqual(["Title", "Content", "Book notes", "Notes"]);
});

test("the folder menu sets the folder's language", async ({ page }) => {
  const id = await seedStory("alice", { title: "Język", folder: "Lang" });
  await page.goto(`/chapters/${id}`);
  await page.getByRole("link", { name: "Lang" }).click();

  await openMenu(page.getByRole("button", { name: "Actions for Lang" }));
  await page.getByRole("menuitem", { name: "Language", exact: true }).hover();
  const polish = page.getByRole("menuitemradio", { name: "Polish" });
  // A folder from before task 29 has no language stored and is Polish.
  await expect(polish).toHaveAttribute("aria-checked", "true");
  await polish.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  // Not getByRole("alert"): Next.js announces the page title in one.
  await expect(page.locator("p[role=alert]")).toHaveCount(0);
  await expect
    .poll(() =>
      withE2EDb(async (connection) => {
        const folder = await connection
          .collection("folders")
          .findOne({ name: "Lang" });
        return folder?.language;
      }),
    )
    .toBe("pl");

  await page.reload();
  await expectPolish(markdownEditor(page, "Book notes").field);
  await page.getByRole("link", { name: "Język" }).click();
  await expectPolish(page.getByRole("textbox", { name: "Title" }));
  await expectPolish(markdownEditor(page, "Content").field);
});
