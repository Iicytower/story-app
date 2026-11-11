import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";

test.beforeEach(async () => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
});

test("dave mentions @Erin from the suggestions; erin is notified and the link opens her profile", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(CHAPTER);
  const field = page.getByRole("textbox", { name: en.comments.newLabel });
  await field.pressSequentially("Thanks @er");
  const list = page.getByRole("listbox", { name: en.mentions.suggestions });
  const erin = list.getByRole("option", { name: "Erin" });
  await expect(erin).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveAttribute("aria-activedescendant", /.+/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(list).toBeHidden();
  await expect(field).toHaveValue("Thanks @Erin ");
  await expect(field).toBeFocused();
  await field.pressSequentially("for the tip");
  // Escape closes the list and Enter goes back to the textarea.
  await field.pressSequentially(" @Al");
  await expect(list.getByRole("option", { name: "Alice" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("Thanks @Erin for the tip @Al\n");
  await page.getByRole("button", { name: en.comments.submit }).click();

  const mention = page.getByRole("link", { name: "@Erin", exact: true });
  await expect(mention).toBeVisible();
  // "@Al" is no nickname: it stays text.
  await expect(
    page.getByRole("link", { name: "@Al", exact: true }),
  ).toHaveCount(0);

  const reader = await loginAs(browser, "erin");
  await reader.page.goto("/en/stories");
  await reader.page
    .getByRole("button", { name: "Notifications, 1 unread", exact: true })
    .click();
  const panel = reader.page.getByRole("dialog", {
    name: en.notifications.title,
  });
  await panel
    .getByRole("button", { name: /Dave mentioned you in a comment on “One”/ })
    .click();
  await expect(reader.page).toHaveURL(
    /\/en\/p\/Alice\/book\/one#comment-[0-9a-f]{24}$/,
  );
  await reader.page.getByRole("link", { name: "@Erin", exact: true }).click();
  await expect(reader.page).toHaveURL(/\/en\/p\/Erin$/);
  await reader.context.close();
});

test("the arrows choose another suggestion and a click takes it", async ({
  page,
}) => {
  await page.goto(CHAPTER);
  const field = page.getByRole("textbox", { name: en.comments.newLabel });
  await field.pressSequentially("@a");
  const list = page.getByRole("listbox", { name: en.mentions.suggestions });
  const option = (name: string) => list.getByRole("option", { name });
  await expect(list.getByRole("option").nth(0)).toHaveText("Admin");
  await expect(list.getByRole("option").nth(1)).toHaveText("Alice");
  await expect(option("Admin")).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("status")).toHaveText(
    /^\d+ nickname suggestions?$/,
  );
  await page.keyboard.press("ArrowDown");
  await expect(option("Alice")).toHaveAttribute("aria-selected", "true");
  const id = await option("Alice").getAttribute("id");
  await expect(field).toHaveAttribute("aria-activedescendant", id!);
  await option("Admin").click();
  await expect(field).toHaveValue("@Admin ");
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-expanded", "false");

  // A key typed after the list showed: Enter never takes a suggestion of the old prefix.
  await field.pressSequentially("@Er");
  await expect(list.getByRole("option", { name: "Erin" })).toBeVisible();
  await field.press("x");
  await field.press("Enter");
  await expect(field).toHaveValue("@Admin @Erx\n");
});
