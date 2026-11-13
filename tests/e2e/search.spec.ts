import type { Browser, Page } from "@playwright/test";
import {
  exhaustSearchLimit,
  findFolder,
  seedStory,
  updateFolder,
  withE2EDb,
} from "./db";
import { E2E_IP_HEADER, storageStatePath } from "./env";
import { expect, menuAction, publicLinkRow, test } from "./helpers";

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

async function anonymous(
  browser: Browser,
  extraHTTPHeaders?: Record<string, string>,
) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders,
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

test("a result shows the published book's description as plain text", async ({
  browser,
}) => {
  await seedPublished();
  await updateFolder("Book", { description: "A <b>bold</b> saga." });
  const visitor = await anonymous(browser);

  await search(visitor, "dragon");
  const description = visitor
    .getByRole("list", { name: "Search results" })
    .getByText("A <b>bold</b> saga.", { exact: true });
  await expect(description).toBeVisible();
  expect((await description.boundingBox())!.height).toBeLessThanOrEqual(24);

  await updateFolder("Book", { published: false });
  await search(visitor, "dragon");
  await expect(visitor.getByText("No stories found.")).toBeVisible();
  expect(await visitor.content()).not.toContain("bold</b> saga");
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

test("a visitor filters by a category and finds it by its label", async ({
  browser,
}) => {
  await seedPublished();
  const folder = await findFolder("Book");
  await withE2EDb((connection) =>
    connection
      .collection("stories")
      .updateMany({ folderId: folder!._id }, { $set: { tags: ["crime"] } }),
  );
  const visitor = await anonymous(browser);
  await visitor.goto("/");

  const categories = visitor.getByRole("navigation", {
    name: "Filter by category",
  });
  await expect(categories.getByRole("link")).toHaveText(["Crime"]);
  await expect(
    visitor
      .getByRole("navigation", { name: "Filter by tag" })
      .getByRole("link"),
  ).toHaveText(["epika"]);
  await categories.getByRole("link", { name: "Crime" }).click();
  await expect(visitor).toHaveURL(/tag=crime/);
  await expect(results(visitor)).toHaveCount(1);

  await search(visitor, "Kryminał");
  await expect(results(visitor)).toHaveCount(1);
  await expect(results(visitor)).toContainText("Crime");
});

test("unpublishing and deleting take a story out of the results", async ({
  page,
  browser,
}) => {
  const { folderId } = await seedPublished();
  const visitor = await anonymous(browser);
  await search(visitor, "dragon");
  await expect(results(visitor)).toHaveCount(1);

  await page.goto(`/books/${folderId}`);
  await menuAction(page, "Actions for Book", "Unpublish");
  await page
    .getByRole("alertdialog", { name: "Unpublish book?" })
    .getByRole("button", { name: "Unpublish" })
    .click();
  await expect(publicLinkRow(page)).toBeHidden();
  await search(visitor, "dragon");
  await expect(visitor.getByText("No stories found.")).toBeVisible();
  await expect(visitor.getByRole("link", { name: "smoki" })).toHaveCount(0);

  await menuAction(page, "Actions for Book", "Publish");
  await page
    .getByRole("alertdialog", { name: "Publish book?" })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(publicLinkRow(page)).toBeVisible();
  await search(visitor, "dragon");
  await expect(results(visitor)).toHaveCount(1);

  await menuAction(page, "Actions for Dragon Tale", "Delete");
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
  const first = await anonymous(browser, {
    [E2E_IP_HEADER]: "203.0.113.7",
    "x-forwarded-for": "198.51.100.1",
  });
  await search(first, "dragon");
  await expect(results(first)).toHaveCount(1);

  await exhaustSearchLimit();
  // The same client with another X-Forwarded-For gets no fresh limit (D74).
  const visitor = await anonymous(browser, {
    [E2E_IP_HEADER]: "203.0.113.7",
    "x-forwarded-for": "198.51.100.2",
  });
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
  await page.goto("/books");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Home" })
    .click();
  await expect(page).toHaveURL("/en");
  await page.getByRole("searchbox").fill("dragon");
  await page.getByRole("searchbox").press("Enter");
  await expect(results(page)).toHaveCount(1);
});

test("the search button runs the search and the placeholder fits at 375 px", async ({
  browser,
}) => {
  await seedPublished();
  const visitor = await anonymous(browser);
  await visitor.goto("/");
  await visitor
    .getByRole("searchbox", { name: "Search published stories" })
    .fill("dragon");
  await visitor.getByRole("button", { name: "Search", exact: true }).click();
  await expect(visitor).toHaveURL(/\?q=dragon/);
  await expect(results(visitor)).toHaveCount(1);

  await visitor.setViewportSize({ width: 375, height: 800 });
  for (const [path, placeholder] of [
    ["/en", "Search stories"],
    ["/pl", "Szukaj opowiadań"],
  ]) {
    await visitor.goto(path);
    const field = visitor.getByRole("searchbox");
    await expect(field).toHaveAttribute("placeholder", placeholder);
    const fits = await field.evaluate((input: HTMLInputElement) => {
      const style = getComputedStyle(input);
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = style.font;
      const room =
        input.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      return context.measureText(input.placeholder).width <= room;
    });
    expect(fits).toBe(true);
  }
});
