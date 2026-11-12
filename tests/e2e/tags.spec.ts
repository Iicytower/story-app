import { findFolder, seedFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("tags a folder and a chapter, then filters /books with search", async ({
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

  await page.goto(`/books/${folderId}`);
  await menuAction(page, "Actions for Saga", "Tags");
  const folderDialog = page.getByRole("dialog", { name: "Tags for Saga" });
  await folderDialog.getByLabel("Add tag").fill("Mythic");
  await folderDialog.getByLabel("Add tag").press("Enter");
  await expect(
    folderDialog
      .getByRole("list", { name: "Your tags" })
      .getByRole("button", { name: "mythic" }),
  ).toHaveAttribute("aria-pressed", "true");
  await folderDialog.getByRole("button", { name: "Save" }).click();
  await expect(folderDialog).toBeHidden();

  await menuAction(page, "Actions for Dragon tale", "Tags");
  const chapterDialog = page.getByRole("dialog", {
    name: "Tags for Dragon tale",
  });
  const inherited = chapterDialog.getByRole("button", { name: "mythic" });
  await expect(inherited).toHaveAttribute("aria-pressed", "true");
  await expect(inherited).toBeDisabled();
  await chapterDialog.getByLabel("Add tag").fill("draft, drop me");
  await chapterDialog.getByRole("button", { name: "Add", exact: true }).click();
  const dropMe = chapterDialog.getByRole("button", { name: "drop me" });
  await expect(dropMe).toHaveAttribute("aria-pressed", "true");
  await dropMe.click();
  await expect(dropMe).toHaveAttribute("aria-pressed", "false");
  await chapterDialog.getByRole("button", { name: "Save" }).click();
  await expect(chapterDialog).toBeHidden();
  const row = page
    .getByRole("list", { name: "Chapters" })
    .getByRole("listitem");
  await expect(row.filter({ hasText: "Dragon tale" })).toContainText("draft");
  await expect(row.filter({ hasText: "Dragon tale" })).not.toContainText(
    "drop me",
  );

  await page.goto("/books");
  const filter = page.getByRole("navigation", { name: "Filter by tag" });
  await filter.getByRole("link", { name: "mythic" }).click();
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveCount(2);

  await filter.getByRole("link", { name: "draft" }).click();
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).toContainText("Dragon tale");

  await filter.getByRole("link", { name: "draft" }).click();
  await expect(results.getByRole("listitem")).toHaveCount(2);

  await page.getByLabel("Search books").fill("dragon");
  await page.getByLabel("Search books").press("Enter");
  await expect(page).toHaveURL(/q=dragon/);
  await expect(page).toHaveURL(/tag=mythic/);
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await expect(results).toContainText("Dragon tale");
  await expect(results).not.toContainText("Elsewhere");
});

test("does not suggest or filter by tags of another user", async ({ page }) => {
  await seedStory("bob", { title: "Bob's", folder: "Bob's", tags: ["secret"] });
  await page.goto("/books");
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

  await seedStory("bob", {
    title: "Bob's public",
    folder: "Bob's book",
    tags: ["space opera"],
  });
  await seedStory("bob", {
    title: "Bob's private",
    folder: "Bob's notes",
    tags: ["secret fiction"],
  });
  const bobsBook = await findFolder("Bob's book");
  await withE2EDb(async (connection) => {
    await connection
      .collection("folders")
      .updateOne({ _id: bobsBook!._id }, { $set: { published: true } });
    await connection
      .collection("stories")
      .updateMany(
        { folderId: bobsBook!._id },
        { $set: { publication: "public" } },
      );
  });

  await page.goto(`/books/${folderId}`);
  await menuAction(page, "Actions for Stars", "Tags");
  const dialog = page.getByRole("dialog", { name: "Tags for Stars" });
  const categoryList = dialog.getByRole("list", { name: "Categories" });
  await expect(categoryList.getByRole("button")).toHaveCount(23);
  await expect(
    dialog.getByRole("list", { name: "Your tags" }).getByRole("button"),
  ).toHaveText(["scifi"]);
  const horror = categoryList.getByRole("button", { name: "Horror" });
  await horror.click();
  await expect(horror).toHaveAttribute("aria-pressed", "true");
  await horror.click();
  await expect(horror).toHaveAttribute("aria-pressed", "false");

  const field = dialog.getByLabel("Add tag");
  const suggestions = dialog.getByRole("list", { name: "Suggestions" });
  await field.fill("fict");
  // Bob's private tag stays hidden, public tags of other authors are suggested.
  await expect(suggestions.getByRole("button")).toHaveText([
    "Fanfiction",
    "Flash fiction",
    "Nonfiction",
    "Science fiction",
  ]);
  await field.fill("space");
  await expect(suggestions.getByRole("button")).toHaveText(["space opera"]);
  await field.fill("science");
  await suggestions.getByRole("button", { name: "Science fiction" }).click();
  await expect(field).toHaveValue("");
  await expect(
    categoryList.getByRole("button", { name: "Science fiction" }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTitle("Category")).toHaveText("Science fiction");

  await page.goto("/books");
  const categories = page.getByRole("navigation", {
    name: "Filter by category",
  });
  const own = page.getByRole("navigation", { name: "Filter by tag" });
  await expect(own.getByRole("link")).toHaveText(["scifi"]);
  await categories.getByRole("link", { name: "Science fiction" }).click();
  await expect(page).toHaveURL(/tag=sci-fi/);
  const results = page.getByRole("list", { name: "Search results" });
  await expect(results.getByRole("listitem")).toHaveText([/Orbit/]);

  await page.goto("/pl/books?q=Fantastyka+naukowa");
  await expect(
    page.getByRole("navigation", { name: "Filtruj po kategorii" }),
  ).toHaveText("Fantastyka naukowa");
  await expect(
    page.getByRole("list", { name: "Wyniki wyszukiwania" }).getByRole("listitem"),
  ).toHaveText([/Orbit/]);
});
