import en from "@/messages/en.json";
import { countFollows, seedFollow, seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, openMenu, openSettings, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const CHAPTER = "/en/p/Alice/book/one";

test("alice blocks dave from his comment and unblocks him in the settings", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  await seedFollow("dave", "alice");
  await seedFollow("alice", "dave");

  const dave = await loginAs(browser, "dave");
  await dave.page.goto(CHAPTER);
  await dave.page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Hello from Dave");
  await dave.page.getByRole("button", { name: en.comments.submit }).click();
  await expect(dave.page.getByText("Hello from Dave")).toBeVisible();

  await page.goto(CHAPTER);
  await expect(page.getByText("Hello from Dave")).toBeVisible();
  await openMenu(page.getByRole("button", { name: /comment by Dave/ }));
  await page.getByRole("menuitem", { name: "Block Dave" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Block Dave?" });
  await confirm.getByRole("button", { name: en.blocking.block }).click();
  await expect(confirm).toBeHidden();
  // Criterion 2: the blocker no longer sees the comment.
  await expect(page.getByText("Hello from Dave")).toBeHidden();
  await expect(page.locator("#comments-title")).toBeFocused();
  expect(await countFollows()).toBe(0);

  await page.goto("/en/p/Dave");
  await expect(
    page.getByRole("button", { name: "Unblock Dave" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: en.profile.follow }),
  ).toHaveCount(0);

  // Criterion 3: dave still reads alice's public chapter.
  await dave.page.goto(CHAPTER);
  await expect(dave.page.getByText("Chapter text")).toBeVisible();
  await dave.page.goto("/en/p/Alice");
  await expect(
    dave.page.getByRole("button", { name: en.profile.follow }),
  ).toHaveCount(0);
  await dave.page.getByRole("button", { name: en.profile.message }).click();
  const message = dave.page.getByRole("dialog", { name: "Message to Alice" });
  await message
    .getByRole("textbox", { name: en.messages.newLabel })
    .fill("Hi Alice");
  await message.getByRole("button", { name: en.messages.send }).click();
  await expect(message.getByRole("alert")).toHaveText(
    en.errors.interactionNotAllowed,
  );
  await dave.context.close();

  // Criterion 5: the list in the settings, with Unblock.
  const settings = await openSettings(page, "Profile");
  const blocked = settings.getByRole("list", {
    name: en.settings.blocked,
  });
  await expect(blocked.getByText("Dave")).toBeVisible();
  await settings.getByRole("button", { name: "Unblock Dave" }).click();
  await expect(
    settings.getByText("You have not blocked anyone."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  await page.goto(CHAPTER);
  await expect(page.getByText("Hello from Dave")).toBeVisible();
  await page.goto("/en/p/Dave");
  await expect(
    page.getByRole("button", { name: en.profile.follow }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Block Dave" })).toBeVisible();
});

test("alice blocks dave from his profile", async ({ page }) => {
  await page.goto("/en/p/Dave");
  await page.getByRole("button", { name: "Block Dave" }).click();
  await page
    .getByRole("alertdialog", { name: "Block Dave?" })
    .getByRole("button", { name: en.blocking.block })
    .click();
  const unblock = page.getByRole("button", { name: "Unblock Dave" });
  await expect(unblock).toBeFocused();
  await unblock.click();
  await expect(page.getByRole("button", { name: "Block Dave" })).toBeFocused();
});
