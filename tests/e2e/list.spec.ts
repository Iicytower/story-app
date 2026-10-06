import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("shows a message when there are no stories", async ({ page }) => {
  await page.goto("/stories");
  await expect(page.getByText("No stories yet.")).toBeVisible();
});

test("lists stories newest first with the start of the content", async ({
  page,
}) => {
  await seedStory("alice", {
    title: "Older",
    content: "First words of the older story",
    updatedAt: new Date("2026-01-01"),
  });
  await seedStory("alice", {
    title: "Newer",
    content: "Beginning of the newer one",
    updatedAt: new Date("2026-02-01"),
  });

  await page.goto("/stories");
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Newer");
  await expect(items.nth(0)).toContainText("Beginning of the newer one");
  await expect(items.nth(1)).toContainText("Older");
});

test("searches on Enter and highlights the match", async ({ page }) => {
  await seedStory("alice", {
    title: "Knight",
    content: "The knight met a Dragon near the river.",
  });
  await seedStory("alice", { title: "Garden", content: "Flowers only." });

  await page.goto("/stories");
  const search = page.getByRole("searchbox", { name: "Search stories" });
  await search.fill("dragon");
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await search.press("Enter");
  await expect(page).toHaveURL("/stories?q=dragon");
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Knight");
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

  test("does not see alice's stories", async ({ page }) => {
    await seedStory("alice", { title: "Alice secret", content: "dragon" });
    await seedStory("bob", { title: "Bob story" });

    await page.goto("/stories");
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText("Bob story")).toBeVisible();
    await expect(page.getByText("Alice secret")).toHaveCount(0);

    await page.goto("/stories?q=dragon");
    await expect(page.getByText('No stories match "dragon".')).toBeVisible();
  });
});
