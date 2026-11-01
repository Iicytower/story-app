import type { Browser, Page } from "@playwright/test";
import { exhaustSearchLimit, findFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const COMMENT = "secret-comment-7e21";
const NOTE = "secret-note-19ab";

async function seedPublished() {
  const id = await seedStory("alice", {
    title: "Dragon Tale",
    folder: "Book",
    content: `Zielona łąka <!-- ${COMMENT} -->`,
    notes: NOTE,
    tags: ["smoki"],
  });
  const folder = await findFolder("Book");
  await withE2EDb(async (connection) => {
    await connection
      .collection("folders")
      .updateOne(
        { _id: folder!._id },
        { $set: { published: true, tags: ["epika"] } },
      );
    await connection
      .collection("stories")
      .updateMany(
        { folderId: folder!._id },
        { $set: { publication: "public" } },
      );
  });
  return { id, folderId: folder!._id.toString() };
}

async function anonymous(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  return context.newPage();
}

async function search(page: Page, text: string) {
  await page.goto("/");
  const field = page.getByRole("searchbox", {
    name: "Search published stories",
  });
  await field.fill(text);
  await field.press("Enter");
}

const results = (page: Page) =>
  page.getByRole("list", { name: "Search results" }).getByRole("link");

test("a visitor finds a story by title, tag and text and opens it", async ({
  browser,
}) => {
  await seedPublished();
  const visitor = await anonymous(browser);

  for (const text of ["dragon", "SMOKI", "epika", "zielona łąka"]) {
    await search(visitor, text);
    await expect(results(visitor)).toHaveCount(1);
    await expect(results(visitor)).toContainText("by Alice");
  }
  const html = await visitor.content();
  for (const secret of [COMMENT, NOTE]) expect(html).not.toContain(secret);

  await results(visitor).click();
  await expect(visitor).toHaveURL(/\/p\/Alice\/book\/dragon-tale$/);
  await expect(visitor.getByText("Zielona łąka")).toBeVisible();
});

test("a word from a comment finds nothing", async ({ browser }) => {
  await seedPublished();
  const visitor = await anonymous(browser);

  await search(visitor, COMMENT);
  await expect(visitor.getByText("No stories found.")).toBeVisible();
});

test("clicked tags are required, and the text box keeps them", async ({
  browser,
}) => {
  await seedPublished();
  await seedStory("alice", {
    title: "Other",
    folder: "Book",
    content: "Zielona łąka",
  });
  const folder = await findFolder("Book");
  await withE2EDb((connection) =>
    connection
      .collection("stories")
      .updateMany(
        { folderId: folder!._id },
        { $set: { publication: "public" } },
      ),
  );
  const visitor = await anonymous(browser);
  await visitor.goto("/");

  const tags = visitor.getByRole("navigation", { name: "Filter by tag" });
  await tags.getByRole("link", { name: "epika" }).click();
  await expect(results(visitor)).toHaveCount(2);
  await tags.getByRole("link", { name: "smoki" }).click();
  await expect(results(visitor)).toHaveCount(1);

  const field = visitor.getByRole("searchbox");
  await field.fill("łąka");
  await field.press("Enter");
  await expect(visitor).toHaveURL(/tag=epika&tag=smoki/);
  await expect(results(visitor)).toHaveCount(1);

  await tags.getByRole("link", { name: "smoki" }).click();
  await expect(results(visitor)).toHaveCount(2);
});

test("unpublishing and deleting take a story out of the results", async ({
  page,
  browser,
}) => {
  const { folderId } = await seedPublished();
  const visitor = await anonymous(browser);
  await search(visitor, "dragon");
  await expect(results(visitor)).toHaveCount(1);

  await page.goto(`/folders/${folderId}`);
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish", exact: true }),
  ).toBeVisible();
  await search(visitor, "dragon");
  await expect(visitor.getByText("No stories found.")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "smoki" })).toHaveCount(0);

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  await search(visitor, "dragon");
  await expect(results(visitor)).toHaveCount(1);

  await page
    .getByRole("listitem")
    .filter({ hasText: "Dragon Tale" })
    .getByRole("button", { name: /Delete/ })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await search(visitor, "dragon");
  await expect(visitor.getByText("No stories found.")).toBeVisible();
});

test("over the limit a message replaces the results; the empty page still works", async ({
  browser,
}) => {
  await seedPublished();
  const visitor = await anonymous(browser);
  await search(visitor, "dragon");
  await expect(results(visitor)).toHaveCount(1);

  await exhaustSearchLimit();
  await search(visitor, "dragon");

  await expect(visitor.getByText("Too many searches")).toBeVisible();
  await expect(results(visitor)).toHaveCount(0);

  await visitor.goto("/");
  await expect(visitor.getByRole("searchbox")).toBeVisible();
  await expect(
    visitor.getByRole("alert").filter({ hasText: "Too many" }),
  ).toHaveCount(0);
});

test("the search page can be indexed", async ({ browser }) => {
  const visitor = await anonymous(browser);
  const response = await visitor.goto("/");
  expect(response!.headers()["x-robots-tag"]).toBeUndefined();
  await expect(visitor.locator('meta[name="robots"]')).toHaveCount(0);
});

test("a signed-in user searches in the sidebar view", async ({ page }) => {
  await seedPublished();
  await page.goto("/stories");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Search" })
    .click();
  await expect(page).toHaveURL("/");
  await page.getByRole("searchbox").fill("dragon");
  await page.getByRole("searchbox").press("Enter");
  await expect(results(page)).toHaveCount(1);
});
