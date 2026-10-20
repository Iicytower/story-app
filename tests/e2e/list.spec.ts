import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("shows a message when there are no folders", async ({ page }) => {
  await page.goto("/stories");
  await expect(page.getByText("No folders yet.")).toBeVisible();
});

test("lists folders by last activity with chapter counts", async ({ page }) => {
  await seedFolder("alice", "Older", new Date("2026-01-01"));
  await seedFolder("alice", "Newer", new Date("2026-02-01"));
  await seedStory("alice", { title: "One", folder: "Older" });
  await seedStory("alice", { title: "Two", folder: "Older" });

  await page.goto("/stories");
  const items = page
    .getByRole("list", { name: "Folders" })
    .getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Newer");
  await expect(items.nth(0)).toContainText("0 chapters");
  await expect(items.nth(1)).toContainText("Older");
  await expect(items.nth(1)).toContainText("2 chapters");
});

test("searches on Enter, highlights the match and shows the folder", async ({
  page,
}) => {
  await seedStory("alice", {
    title: "Knight",
    folder: "Book",
    content: "The knight met a Dragon near the river.",
  });
  await seedStory("alice", { title: "Garden", content: "Flowers only." });

  await page.goto("/stories");
  const search = page.getByRole("searchbox", { name: "Search stories" });
  await search.fill("dragon");
  await search.press("Enter");

  await expect(page).toHaveURL("/stories?q=dragon");
  const items = page
    .getByRole("list", { name: "Search results" })
    .getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Knight");
  await expect(items.first()).toContainText("in Book");
  await expect(items.first().locator("mark")).toHaveText("Dragon");
});

test("shows a message when nothing matches", async ({ page }) => {
  await seedStory("alice", { title: "Knight", content: "No match here." });

  await page.goto("/stories");
  const search = page.getByRole("searchbox", { name: "Search stories" });
  await search.fill("(unicorn");
  await search.press("Enter");
  await expect(page.getByText('No stories match "(unicorn".')).toBeVisible();
});

test.describe("as bob", () => {
  test.use({ storageState: storageStatePath("bob") });

  test("does not see alice's folders, stories and folder page", async ({
    page,
  }) => {
    await seedStory("alice", {
      title: "Alice secret",
      folder: "Alice folder",
      content: "dragon",
    });
    await seedStory("bob", { title: "Bob story", folder: "Bob folder" });

    await page.goto("/stories");
    await expect(page.getByText("Bob folder")).toBeVisible();
    await expect(page.getByText("Alice folder")).toHaveCount(0);

    await page.goto("/stories?q=dragon");
    await expect(page.getByText('No stories match "dragon".')).toBeVisible();

    const response = await page.goto(
      `/folders/${await seedFolder("alice", "Alice folder")}`,
    );
    expect(response?.status()).toBe(404);
  });
});
