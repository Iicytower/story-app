import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("tags a folder and a chapter, then filters /stories with search", async ({
  page,
}) => {
  const folderId = await seedFolder("alice", "Saga");
  await seedStory("alice", {
    title: "Dragon tale",
    folder: "Saga",
    content: "A dragon sleeps.",
  });
  await seedStory("alice", {
    title: "Quiet tale",
    folder: "Saga",
    content: "Nothing happens.",
  });
  await seedStory("alice", {
    title: "Elsewhere",
    folder: "Other",
    content: "A dragon too.",
  });

  await page.goto(`/folders/${folderId}`);
  await menuAction(page, "Actions for Saga", "Tags");
  const folderDialog = page.getByRole("dialog", { name: "Tags for Saga" });
  await folderDialog.getByLabel("Add tag").fill("Mythic");
  await folderDialog.getByLabel("Add tag").press("Enter");
  await expect(folderDialog.getByRole("listitem")).toHaveText("mythic");
  await folderDialog.getByRole("button", { name: "Save" }).click();
  await expect(folderDialog).toBeHidden();

  await menuAction(page, "Actions for Dragon tale", "Tags");
  const chapterDialog = page.getByRole("dialog", {
    name: "Tags for Dragon tale",
  });
  await expect(chapterDialog.getByText("mythic")).toBeVisible();
  await expect(
    chapterDialog.getByRole("button", { name: "Remove mythic" }),
  ).toHaveCount(0);
  await chapterDialog.getByLabel("Add tag").fill("draft, drop me");
  await chapterDialog.getByRole("button", { name: "Add", exact: true }).click();
  await chapterDialog.getByRole("button", { name: "Remove drop me" }).click();
  await chapterDialog.getByRole("button", { name: "Save" }).click();
  await expect(chapterDialog).toBeHidden();
  const row = page
    .getByRole("list", { name: "Chapters" })
    .getByRole("listitem");
  await expect(row.filter({ hasText: "Dragon tale" })).toContainText("draft");

  await page.goto("/stories");
  const filter = page.getByRole("navigation", { name: "Filter by tag" });
  await filter.getByRole("link", { name: "mythic" }).click();
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveCount(2);

  await filter.getByRole("link", { name: "draft" }).click();
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).toContainText("Dragon tale");

  await filter.getByRole("link", { name: "draft" }).click();
  await expect(results.getByRole("listitem")).toHaveCount(2);

  await page.getByLabel("Search stories").fill("dragon");
  await page.getByLabel("Search stories").press("Enter");
  await expect(page).toHaveURL(/q=dragon/);
  await expect(page).toHaveURL(/tag=mythic/);
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).toContainText("Dragon tale");
  await expect(results).not.toContainText("Elsewhere");
});

test("does not suggest or filter by tags of another user", async ({ page }) => {
  await seedStory("bob", { title: "Bob's", folder: "Bob's", tags: ["secret"] });
  await page.goto("/stories");
  await expect(
    page.getByRole("navigation", { name: "Filter by tag" }),
  ).toHaveCount(0);
});

test("picks a predefined tag by its label and filters by it as a category", async ({
  page,
}) => {
  const folderId = await seedFolder("alice", "Stars");
  await seedStory("alice", { title: "Orbit", folder: "Stars" });
  await seedStory("alice", {
    title: "Mine",
    folder: "Other",
    tags: ["scifi"],
  });

  await page.goto(`/folders/${folderId}`);
  await menuAction(page, "Actions for Stars", "Tags");
  const dialog = page.getByRole("dialog", { name: "Tags for Stars" });
  await expect(
    dialog.locator('datalist option[value="Science fiction"]'),
  ).toHaveCount(1);
  await dialog.getByLabel("Add tag").fill("science fiction");
  await dialog.getByLabel("Add tag").press("Enter");
  const chip = dialog.getByRole("listitem");
  await expect(chip).toHaveText("Science fiction");
  await expect(chip).toHaveAttribute("title", "Category");
  await expect(
    dialog.locator('datalist option[value="Science fiction"]'),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTitle("Category")).toHaveText("Science fiction");

  await page.goto("/stories");
  const categories = page.getByRole("navigation", {
    name: "Filter by category",
  });
  const own = page.getByRole("navigation", { name: "Filter by tag" });
  await expect(own.getByRole("link")).toHaveText(["scifi"]);
  await categories.getByRole("link", { name: "Science fiction" }).click();
  await expect(page).toHaveURL(/tag=sci-fi/);
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveText([/Orbit/]);

  await page.goto("/pl/stories?q=Fantastyka+naukowa");
  await expect(
    page.getByRole("navigation", { name: "Filtruj po kategorii" }),
  ).toHaveText("Fantastyka naukowa");
  await expect(
    page.getByRole("list", { name: "Wyniki wyszukiwania" }).getByRole("listitem"),
  ).toHaveText([/Orbit/]);
});
