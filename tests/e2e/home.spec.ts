import type { Page } from "@playwright/test";
import { findFolder, seedStory, withE2EDb } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

// Signed out unless a block says otherwise.
test.use({ storageState: { cookies: [], origins: [] } });

// Chapter i is published i days before the first one, so the list keeps the seeding order.
async function seedPublished(titles: string[]) {
  for (const title of titles) {
    await seedStory("alice", {
      title,
      folder: "Book",
      content: `${title} text`,
    });
  }
  const folder = await findFolder("Book");
  const now = Date.now();
  await withE2EDb(async (connection) => {
    await connection
      .collection("folders")
      .updateOne({ _id: folder!._id }, { $set: { published: true } });
    for (const [index, title] of titles.entries()) {
      await connection.collection("stories").updateOne(
        { folderId: folder!._id, title },
        {
          $set: {
            publication: "public",
            publishedAt: new Date(now - index * DAY - 60_000),
          },
        },
      );
    }
  });
}

const recent = (page: Page, name = "Recently published") =>
  page.getByRole("list", { name }).getByRole("link");

test("a visitor sees the hero in both languages", async ({ page: visitor }) => {
  await visitor.goto("/en");
  await expect(
    visitor.getByRole("heading", {
      level: 1,
      name: "Your stories, from the first line to the first reader",
    }),
  ).toBeVisible();
  await expect(visitor.getByText(/^Write chapter by chapter/)).toBeVisible();
  await expect(
    visitor.getByRole("heading", { level: 2, name: "Search stories" }),
  ).toBeVisible();
  await expect(visitor).toHaveTitle("Story App – write and publish stories");
  await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^Write chapter by chapter/,
  );

  await visitor.goto("/pl");
  await expect(
    visitor.getByRole("heading", {
      level: 1,
      name: "Twoje opowiadania od pierwszego zdania do pierwszego czytelnika",
    }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "Załóż konto", exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "Zaloguj się", exact: true }),
  ).toBeVisible();
  await expect(visitor).toHaveTitle("Story App – pisz i publikuj opowiadania");
});

test("the hero buttons open the dialog in the right mode", async ({
  page: visitor,
}) => {
  await visitor.goto("/");
  const dialog = visitor.getByRole("dialog");

  await visitor
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(dialog.getByRole("heading")).toHaveText("Create account");
  await visitor.keyboard.press("Escape");

  await visitor.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Sign in");
  await dialog.getByRole("button", { name: "Create one" }).click();
  await visitor.keyboard.press("Escape");

  await visitor.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Sign in");
});

test("recently published shows 5 more at a time and stays while searching", async ({
  page: visitor,
}) => {
  const titles = Array.from({ length: 12 }, (_, i) => `Chapter ${i + 1}`);
  await seedPublished(titles);
  await visitor.goto("/");

  await expect(recent(visitor)).toHaveCount(5);
  await expect(recent(visitor).first()).toContainText("Chapter 1");
  await expect(recent(visitor).first()).toContainText("in Book by Alice");
  await expect(recent(visitor).first()).toContainText("1 minute ago");
  await expect(recent(visitor).nth(3)).toContainText("3 days ago");
  const showMore = visitor.getByRole("button", { name: "Show more" });
  await showMore.click();
  await expect(recent(visitor)).toHaveCount(10);
  await expect(recent(visitor).nth(9)).toContainText(
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(Date.now() - 9 * DAY - 60_000)),
  );
  await showMore.click();
  await expect(recent(visitor)).toHaveCount(12);
  await expect(showMore).toBeHidden();

  const field = visitor.getByRole("searchbox");
  await field.fill("Chapter 12");
  await field.press("Enter");
  await expect(
    visitor.getByRole("list", { name: "Search results" }).getByRole("link"),
  ).toHaveCount(1);
  // The list keeps its client state across the search.
  await expect(recent(visitor)).toHaveCount(12);
});

test("recently published has no button for up to 5 and a message when empty", async ({
  page: visitor,
}) => {
  await visitor.goto("/");
  await expect(
    visitor.getByText("Nothing has been published yet."),
  ).toBeVisible();

  await seedPublished(["A", "B", "C", "D", "E"]);
  await visitor.goto("/");
  await expect(recent(visitor)).toHaveCount(5);
  await expect(visitor.getByRole("button", { name: "Show more" })).toHaveCount(
    0,
  );
});

test("a narrow screen does not scroll sideways", async ({ page: visitor }) => {
  await seedPublished([
    "Averyveryverylongtitlewithoutanyspacesthatcouldpushthepagewider",
    "Short",
  ]);
  await visitor.setViewportSize({ width: 375, height: 800 });
  for (const [path, list] of [
    ["/", "Recently published"],
    ["/?q=short", "Recently published"],
    ["/pl", "Ostatnio opublikowane"],
  ]) {
    await visitor.goto(path);
    await expect(recent(visitor, list).first()).toBeVisible();
    expect(
      await visitor.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test.describe("signed in", () => {
  test.use({ storageState: storageStatePath("alice") });

  test("there is no hero and the sidebar has Home without Search", async ({
    page,
  }) => {
    await seedPublished(["Visible"]);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Search stories" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Create account", exact: true }),
    ).toHaveCount(0);
    await expect(recent(page)).toHaveCount(1);

    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Search" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.goto("/stories");
    await nav.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/en");
  });
});
