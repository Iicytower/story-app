import type { Page } from "@playwright/test";
import {
  findFolder,
  markAdultWithCover,
  seedFollow,
  seedPublished as seedBook,
  seedRanking,
  seedStory,
  updateFolder,
  withE2EDb,
} from "./db";
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
  page.getByRole("region", { name }).getByRole("link");

test("a visitor sees the hero in both languages", async ({ page: visitor }) => {
  await visitor.goto("/en");
  await expect(
    visitor.getByRole("heading", {
      level: 1,
      name: "Your books, from the first line to the first reader",
    }),
  ).toBeVisible();
  await expect(visitor.getByText(/^Write chapter by chapter/)).toBeVisible();
  await expect(
    visitor.getByRole("heading", { level: 2, name: "Search stories" }),
  ).toBeVisible();
  await expect(visitor).toHaveTitle("Story App – write and publish books");
  await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^Write chapter by chapter/,
  );

  await visitor.goto("/pl");
  await expect(
    visitor.getByRole("heading", {
      level: 1,
      name: "Twoje książki od pierwszego zdania do pierwszego czytelnika",
    }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "Załóż konto", exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByRole("button", { name: "Zaloguj się", exact: true }),
  ).toBeVisible();
  await expect(visitor).toHaveTitle("Story App – pisz i publikuj książki");
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

test("recently published is a carousel that stays while searching", async ({
  page: visitor,
}) => {
  const titles = Array.from({ length: 12 }, (_, i) => `Chapter ${i + 1}`);
  await seedPublished(titles);
  await visitor.goto("/");

  await expect(recent(visitor).first()).toContainText("Chapter 1");
  await expect(recent(visitor).first()).toContainText("in Book by Alice");
  await expect(recent(visitor).first()).toContainText("1 minute ago");
  await expect(recent(visitor).nth(3)).toContainText("3 days ago");
  await expect(visitor.getByRole("button", { name: "Next" })).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Previous" })).toBeHidden();
  await expect(visitor.getByRole("button", { name: "Show more" })).toHaveCount(
    0,
  );

  const field = visitor.getByRole("searchbox");
  await field.fill("Chapter 12");
  await field.press("Enter");
  await expect(
    visitor.getByRole("list", { name: "Search results" }).getByRole("link"),
  ).toHaveCount(1);
  await expect(recent(visitor).first()).toContainText("Chapter 1");
});

test("recently published shows a message when empty", async ({
  page: visitor,
}) => {
  await visitor.goto("/");
  await expect(
    visitor.getByText("Nothing has been published yet."),
  ).toBeVisible();
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

async function seedRankedBooks() {
  await seedBook("dave", "Night", [
    { title: "Dusk", publication: "public", content: "Dark text" },
  ]);
  await seedBook("erin", "Day", [
    { title: "Dawn", publication: "public", content: "Light text" },
  ]);
  await markAdultWithCover("dave", "Night");
  await seedRanking("weekly", [
    { user: "dave", folder: "Night" },
    { user: "erin", folder: "Day" },
  ]);
  await seedRanking("topRated", []);
}

const ranking = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true }).getByRole("link");

test("a visitor sees the rankings with 18+ badges and no empty sections", async ({
  page: visitor,
}) => {
  await seedRankedBooks();
  await visitor.goto("/");

  const weekly = ranking(visitor, "Popular this week");
  await expect(weekly).toHaveCount(2);
  await expect(weekly.first()).toContainText("Night");
  await expect(weekly.first()).toContainText("by Dave");
  await expect(weekly.first()).toHaveAttribute("href", "/en/p/Dave/night");
  // An 18+ book: the badge instead of its cover, next to the title too.
  await expect(
    weekly.first().getByRole("img", { name: "Cover of Night" }),
  ).toHaveCount(0);
  await expect(
    weekly.first().getByRole("img", { name: "For adults only (18+)" }),
  ).toHaveCount(2);
  await expect(weekly.nth(1)).toContainText("Day");
  await expect(
    weekly.nth(1).getByRole("img", { name: "For adults only (18+)" }),
  ).toHaveCount(0);

  await expect(visitor.getByRole("heading", { name: "Top rated" })).toHaveCount(
    0,
  );

  await visitor.goto("/pl");
  await expect(ranking(visitor, "Popularne w tym tygodniu")).toHaveCount(2);

  await visitor.setViewportSize({ width: 375, height: 800 });
  await visitor.goto("/en");
  await expect(weekly.first()).toBeVisible();
  expect(
    await visitor.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
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
    await page.goto("/books");
    await nav.getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/en");
  });

  test("no category or followed sections; a category chip filters the list", async ({
    page,
  }) => {
    await seedRankedBooks();
    await updateFolder("Day", { tags: ["fantasy"] });
    await seedFollow("alice", "dave");
    await page.goto("/");
    await expect(ranking(page, "Popular this week")).toHaveCount(2);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Recently published",
      "Popular this week",
    ]);

    await page
      .getByRole("navigation", { name: "Filter by category" })
      .getByRole("link", { name: "Fantasy" })
      .click();
    await expect(page).toHaveURL(/tag=fantasy/);
    const results = page
      .getByRole("list", { name: "Search results" })
      .getByRole("link");
    await expect(results).toHaveCount(1);
    await expect(results).toContainText("Dawn");

    await page.goto("/pl");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Ostatnio opublikowane",
      "Popularne w tym tygodniu",
    ]);
  });

  test("the last edited chapter has a Continue link next to New book", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/^Last edited:/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continue" })).toHaveCount(0);
    await page.getByRole("button", { name: "New book" }).click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "New book" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await seedStory("alice", {
      title: "Older",
      folder: "Saga",
      updatedAt: new Date(Date.now() - 60 * 60_000),
    });
    const latest = await seedStory("alice", {
      title: "Latest",
      folder: "Saga",
      updatedAt: new Date(Date.now() - 60_000),
    });
    await seedStory("bob", { title: "Bob's newer", folder: "Other" });
    await seedStory("alice", {
      title: "Deleted",
      folder: "Saga",
      deletedAt: new Date(),
    });
    await page.reload();
    await expect(page.getByText(/^Last edited:/)).toHaveText(
      "Last edited: Latest (Saga)",
    );
    await page.getByRole("link", { name: "Continue" }).click();
    await expect(page).toHaveURL(`/en/chapters/${latest}`);

    await page.goto("/pl");
    await expect(page.getByText(/^Ostatnio edytowane:/)).toHaveText(
      "Ostatnio edytowane: Latest (Saga)",
    );
    await expect(page.getByRole("link", { name: "Kontynuuj" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nowa książka" }),
    ).toBeVisible();
  });
});

test("a visitor does not see the writing shortcut", async ({
  page: visitor,
}) => {
  await seedStory("alice", { title: "Mine", folder: "Saga" });
  await visitor.goto("/");
  await expect(visitor.getByText(/^Last edited:/)).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "New book" })).toHaveCount(
    0,
  );
});
