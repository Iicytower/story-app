import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

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
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  const folderDialog = page.getByRole("dialog", { name: "Tags for Saga" });
  await folderDialog.getByLabel("Add tag").fill("Fantasy");
  await folderDialog.getByLabel("Add tag").press("Enter");
  await expect(folderDialog.getByRole("listitem")).toHaveText("fantasy");
  await folderDialog.getByRole("button", { name: "Save" }).click();
  await expect(folderDialog).toBeHidden();

  await page.getByRole("button", { name: "Tags for Dragon tale" }).click();
  const chapterDialog = page.getByRole("dialog", {
    name: "Tags for Dragon tale",
  });
  await expect(chapterDialog.getByText("fantasy")).toBeVisible();
  await expect(
    chapterDialog.getByRole("button", { name: "Remove fantasy" }),
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
  await filter.getByRole("link", { name: "fantasy" }).click();
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
  await expect(page).toHaveURL(/tag=fantasy/);
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
