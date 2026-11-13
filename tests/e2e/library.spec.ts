import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { findLibraryItems, seedPublished } from "./db";
import { storageStatePath, USERS } from "./env";
import { expect, loginAs, test } from "./helpers";

const library = en.library;

const addButton = (page: Page) =>
  page.getByRole("button", { name: library.add });
const shelf = (page: Page, name: string) =>
  page.getByRole("menuitemcheckbox", { name, exact: true });

test.describe("as a user", () => {
  test.use({ storageState: storageStatePath("dave") });

  test("adds a book from its contents page and sorts it on shelves", async ({
    page,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public" },
    ]);
    await page.goto("/en/p/Alice/book");
    await addButton(page).click();
    await shelf(page, "Reading").click();
    await expect(shelf(page, "Reading")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await shelf(page, "Read later").click();
    await expect(shelf(page, "Read later")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: library.inLibrary }),
    ).toBeVisible();
    expect(await findLibraryItems("dave")).toEqual([
      { shelves: ["Read later", "Reading"] },
    ]);

    await page.goto("/en/library");
    await expect(page).toHaveTitle(en.metadata.library);
    const tabs = page.getByRole("navigation", { name: library.shelves });
    await expect(tabs.getByRole("link")).toHaveText([
      "All (1)",
      "Reading (1)",
      "Read later (1)",
      "Read (0)",
    ]);
    await tabs.getByRole("link", { name: "Read (0)" }).click();
    await expect(page.getByText(library.emptyShelf)).toBeVisible();
    await tabs.getByRole("link", { name: "Read later (1)" }).click();
    await expect(
      page.getByRole("list", { name: "Read later" }).getByRole("link"),
    ).toHaveText(["Book"]);
    await expect(page.getByText("by Alice")).toBeVisible();

    // Moving the book onto "Read" and off "Read later", whose tab it then leaves.
    await page.getByRole("button", { name: "Shelves of Book" }).click();
    await shelf(page, "Read").click();
    await expect(shelf(page, "Read")).toHaveAttribute("aria-checked", "true");
    await shelf(page, "Read later").click();
    await expect(page.getByText(library.emptyShelf)).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveText([
      "All (1)",
      "Reading (1)",
      "Read later (0)",
      "Read (1)",
    ]);

    // Shelves: a new one, a renamed one, and a deleted one whose book stays.
    await page.getByRole("button", { name: library.manage }).click();
    const dialog = page.getByRole("dialog", { name: library.manage });
    await expect(dialog).toBeFocused();
    const names = () =>
      dialog
        .getByRole("listitem")
        .getByRole("textbox")
        .evaluateAll((inputs) =>
          inputs.map((input) => (input as HTMLInputElement).value),
        );
    await dialog.getByLabel(library.newShelf).fill("Favourites");
    await dialog.getByRole("button", { name: library.addShelf }).click();
    await expect(dialog.getByLabel(library.newShelf)).toHaveValue("");
    await expect
      .poll(names)
      .toEqual(["Reading", "Read later", "Read", "Favourites"]);
    const read = dialog.getByRole("listitem").filter({
      has: page.getByLabel("Name of the shelf Read", { exact: true }),
    });
    await expect(
      read.getByRole("button", { name: en.common.rename }),
    ).toHaveCount(0);
    await read.getByRole("textbox").fill("Finished");
    await read.getByRole("button", { name: en.common.rename }).click();
    await expect(
      dialog.getByLabel("Name of the shelf Finished", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Move Favourites up" }).click();
    await expect
      .poll(names)
      .toEqual(["Reading", "Read later", "Favourites", "Finished"]);
    await dialog.getByRole("button", { name: "Delete Reading" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete Reading" })
      .click();
    await expect.poll(names).toEqual(["Read later", "Favourites", "Finished"]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(tabs.getByRole("link")).toHaveText([
      "All (1)",
      "Read later (0)",
      "Favourites (0)",
      "Finished (1)",
    ]);
    await tabs.getByRole("link", { name: "All (1)" }).click();
    await expect(
      page.getByRole("list", { name: library.all }).getByRole("link"),
    ).toHaveText(["Book"]);
    expect(await findLibraryItems("dave")).toEqual([{ shelves: ["Finished"] }]);
  });

  test("a private library disappears from the profile for others", async ({
    page,
    browser,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public" },
    ]);
    await page.goto("/en/p/Alice/book");
    await addButton(page).click();
    await shelf(page, "Reading").click();
    await expect(shelf(page, "Reading")).toHaveAttribute(
      "aria-checked",
      "true",
    );

    const erin = await loginAs(browser, "erin");
    await erin.page.goto("/en/p/Dave");
    const heading = erin.page.getByRole("heading", {
      name: en.profile.library,
    });
    await expect(heading).toBeVisible();
    await expect(
      erin.page.getByRole("list", { name: "Reading" }).getByRole("link"),
    ).toHaveText(["Book"]);

    await page.goto("/en/library");
    // The setting lives in "Manage shelves", not above the shelf tabs (D83, 5.1).
    await expect(
      page.getByRole("navigation", { name: library.shelves }),
    ).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);
    await page.getByRole("button", { name: library.manage }).click();
    const dialog = page.getByRole("dialog", { name: library.manage });
    const toggle = dialog.getByRole("switch", { name: library.public });
    await expect(toggle).toBeChecked();
    await expect(toggle).toHaveAccessibleDescription(library.publicHint);
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.keyboard.press("Escape");
    await erin.page.reload();
    await expect(
      erin.page.getByRole("heading", { name: USERS.dave.nickname }),
    ).toBeVisible();
    await expect(heading).toHaveCount(0);
    await expect(erin.page.getByText(en.profile.libraryPrivate)).toHaveCount(0);
    await erin.context.close();

    await page.goto("/en/p/Dave");
    await expect(page.getByText(en.profile.libraryPrivate)).toBeVisible();
    await page
      .getByRole("link", { name: en.profile.libraryPrivateLink })
      .click();
    await expect(page).toHaveURL("/en/library");
  });
});

test.describe("as a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("gets the sign-in dialog from Add to library and comes back to the book", async ({
    page,
  }) => {
    await seedPublished("alice", "Book", [
      { title: "One", publication: "public" },
    ]);
    await page.goto("/en/p/Alice/book");
    await addButton(page).click();
    const dialog = page.getByRole("dialog", { name: en.auth.signIn });
    await expect(dialog).toBeVisible();
    expect(await findLibraryItems("dave")).toEqual([]);

    await dialog.getByLabel("Nickname").fill(USERS.dave.nickname);
    await dialog.getByLabel("Password").fill(USERS.dave.password);
    await dialog.getByRole("button", { name: en.auth.signIn }).click();
    await expect(page).toHaveURL("/en/p/Alice/book");
    await addButton(page).click();
    await page
      .getByRole("menuitem", { name: library.saveWithoutShelf })
      .click();
    await expect(
      page.getByRole("button", { name: library.inLibrary }),
    ).toBeVisible();
    expect(await findLibraryItems("dave")).toEqual([{ shelves: [] }]);
  });
});
