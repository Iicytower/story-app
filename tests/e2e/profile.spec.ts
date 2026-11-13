import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { findFolder, seedProfile, seedPublished, seedStory } from "./db";
import { storageStatePath } from "./env";
import {
  classifier,
  expect,
  menuAction,
  openSettings,
  png,
  test,
} from "./helpers";

async function seedBooks() {
  await seedProfile("alice", "**Bold words** and <b>raw</b> HTML");
  await seedPublished("alice", "Open book", [
    { title: "First", publication: "public" },
    { title: "Secret", publication: "hidden" },
  ]);
  await seedPublished("alice", "Hidden book", [
    { title: "Only hidden", publication: "hidden" },
  ]);
  await seedStory("alice", { title: "Draft chapter", folder: "Private" });
}

async function expectAliceProfile(page: Page) {
  await page.goto("/en/p/Alice");
  await expect(page).toHaveTitle("Alice – Story App");
  await expect(page.getByRole("heading", { name: "Alice" })).toBeVisible();
  const bio = page.getByRole("region", { name: "About me" });
  await expect(bio.locator("strong")).toHaveText("Bold words");
  await expect(bio.locator("b")).toHaveCount(0);
  const books = page.getByRole("list", { name: "Books" });
  await expect(books.getByRole("link")).toHaveText(["Open book"]);
  await expect(page.getByText("Hidden book")).toHaveCount(0);
  await expect(page.getByText("Private")).toHaveCount(0);
  await books.getByRole("link", { name: "Open book" }).click();
  await expect(page).toHaveURL("/en/p/Alice/open-book");
  await expect(page.getByRole("link", { name: "1. First" })).toBeVisible();
  await expect(page.getByText("Secret")).toHaveCount(0);
}

test.describe("as a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees the bio and only the public books", async ({ page }) => {
    await seedBooks();
    await expectAliceProfile(page);
  });

  test("gets a 404 for an unknown nickname and a redirect for the wrong case", async ({
    page,
  }) => {
    const response = await page.goto("/en/p/Nobody");
    expect(response?.status()).toBe(404);
    await page.goto("/en/p/alice");
    await expect(page).toHaveURL("/en/p/Alice");
  });

  test("sees initials without an avatar", async ({ page }) => {
    await page.goto("/en/p/Bob");
    await expect(page.getByRole("img", { name: "Avatar of Bob" })).toHaveText(
      "B",
    );
    await expect(page.getByText(en.profile.noBooks)).toBeVisible();
  });

  test("a narrow screen does not scroll sideways", async ({ page }) => {
    await seedProfile(
      "alice",
      `See https://example.com/${"averyverylongpathsegment".repeat(6)}`,
    );
    const name =
      "Averyveryverylongtitlewithoutanyspacesthatcouldpushthepagewider";
    await seedPublished("alice", name, [
      { title: "First", publication: "public" },
    ]);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/en/p/Alice");
    await expect(page.getByRole("link", { name })).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("reads the profile in Polish", async ({ page }) => {
    await seedBooks();
    await page.goto("/pl/p/Alice");
    await expect(page).toHaveTitle("Alice – Story App");
    await expect(page.getByRole("heading", { name: "Książki" })).toBeVisible();
    await expect(page.getByRole("region", { name: "O mnie" })).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Avatar: Alice" }),
    ).toBeVisible();
  });
});

test.describe("as a user", () => {
  test.use({ storageState: storageStatePath("alice") });

  test.beforeEach(() => classifier("safe"));
  test.afterEach(() => classifier("safe"));

  test("another user sees the same public profile", async ({ browser }) => {
    await seedBooks();
    const context = await browser.newContext({
      storageState: storageStatePath("bob"),
    });
    await expectAliceProfile(await context.newPage());
    await context.close();
  });

  test("the owner edits “About me” and finds it through My profile", async ({
    page,
  }) => {
    await page.goto("/en/books");
    const dialog = page.getByRole("dialog", { name: "Settings" });
    // The API for "Edit profile" (task 102); repeated until the sidebar has hydrated.
    await expect(async () => {
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("story-app:open-settings", { detail: "profile" }),
        ),
      );
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(
      dialog.getByRole("tab", { name: "Profile", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const bio = dialog.getByRole("textbox", { name: "About me" });
    await expect(bio).toHaveValue("");
    await bio.fill("I write *short* stories.");
    await expect(dialog.getByText("24 / 1,000")).toBeVisible();
    await dialog.getByRole("button", { name: "Update “About me”" }).click();
    await expect(
      dialog.getByRole("region", { name: "About me" }).getByRole("status"),
    ).toHaveText("“About me” is saved.");
    await page.keyboard.press("Escape");

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "My profile" })
      .click();
    await expect(page).toHaveURL("/en/p/Alice");
    await expect(
      page.getByRole("region", { name: "About me" }).locator("em"),
    ).toHaveText("short");

    const again = await openSettings(page, "Profile");
    await again.getByRole("link", { name: "View profile" }).click();
    await expect(again).toBeHidden();
    await expect(page).toHaveURL("/en/p/Alice");
  });

  test("the owner sees an 18+ cover with its badge, others only the badge", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "Night", publication: "public" },
    ]);
    const id = (await findFolder("Book"))!._id.toString();
    await page.goto(`/en/books/${id}`);
    await menuAction(page, "Actions for Book", "Cover");
    const dialog = page.getByRole("dialog", { name: "Cover of Book" });
    await classifier("adult");
    await dialog.getByLabel("Choose image").setInputFiles({
      name: "cover.png",
      mimeType: "image/png",
      buffer: png(40, 30, [10, 10, 10]),
    });
    await expect(
      dialog.getByRole("img", { name: "Cover frame" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Save cover" }).click();
    await expect(dialog.getByRole("status")).toContainText("rated 18+");

    const books = (p: Page) => p.getByRole("list", { name: "Books" });
    const badge = en.adult.label;
    await page.goto("/en/p/Alice");
    const cover = books(page).getByRole("img", { name: "Cover of Book" });
    await expect(cover).toHaveAttribute("src", /^\/covers\/[0-9a-f]{24}$/);
    await expect(cover).not.toHaveClass(/blur/);
    await expect(books(page).getByRole("img", { name: badge })).not.toHaveCount(
      0,
    );

    const context = await browser.newContext({
      storageState: storageStatePath("bob"),
    });
    const other = await context.newPage();
    await other.goto("/en/p/Alice");
    await expect(
      books(other).getByRole("link", { name: "Book" }),
    ).toBeVisible();
    await expect(
      books(other).getByRole("img", { name: "Cover of Book" }),
    ).toHaveCount(0);
    await expect(
      books(other).getByRole("img", { name: badge }),
    ).not.toHaveCount(0);
    await context.close();
  });

  test("an avatar rated safe shows on the profile, one rated 18+ is refused", async ({
    page,
  }) => {
    await page.goto("/en/books");
    const settings = await openSettings(page, "Profile");
    await settings.getByRole("button", { name: "Avatar", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Avatar", exact: true });
    await expect(dialog.getByText(en.avatar.none)).toBeVisible();

    const upload = async (rgb: [number, number, number]) => {
      await dialog.getByLabel("Choose image").setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: png(40, 30, rgb),
      });
      await expect(
        dialog.getByRole("img", { name: "Avatar frame" }),
      ).toBeVisible();
      await dialog.getByRole("button", { name: "Save avatar" }).click();
    };

    await upload([200, 40, 40]);
    await expect(dialog.getByRole("status")).toHaveText("The avatar is saved.");
    await expect(
      dialog.getByRole("img", { name: "Current avatar" }),
    ).toBeVisible();

    await classifier("adult");
    await upload([10, 10, 10]);
    await expect(dialog.getByRole("alert")).toHaveText(en.errors.avatarAdult);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/en/p/Alice");
    const avatar = page.getByRole("img", { name: "Avatar of Alice" });
    await expect(avatar).toHaveAttribute("src", /^\/avatars\/[0-9a-f]{24}$/);
    await expect(avatar).toHaveJSProperty("naturalWidth", 256);
    await expect(avatar).toHaveJSProperty("naturalHeight", 256);
  });
});
