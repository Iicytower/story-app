import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, test } from "./helpers";

test.use({ storageState: storageStatePath("dave") });

const CHAPTER = "/en/p/Alice/book/one";

const chapterBar = (page: Page) =>
  page.getByRole("group", { name: en.reactions.chapter });
const commentBar = (page: Page, nickname: string) =>
  page.getByRole("group", {
    name: en.reactions.comment.replace("{nickname}", nickname),
  });
const reaction = (bar: ReturnType<typeof chapterBar>, name: string) =>
  bar.getByRole("button", { name, exact: true });

async function pick(
  page: Page,
  bar: ReturnType<typeof chapterBar>,
  name: keyof typeof en.reactions.names,
) {
  await bar.getByRole("button", { name: en.reactions.add }).click();
  await page
    .getByRole("group", { name: en.reactions.pick })
    .getByRole("button", { name: en.reactions.names[name] })
    .click();
}
test("dave and erin react to a chapter and a comment; a guest sees the counts and signs in to react", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await page.goto(CHAPTER);
  // Without reactions there is only "Add reaction" and no total count.
  await expect(chapterBar(page).getByRole("button")).toHaveCount(1);
  await pick(page, chapterBar(page), "heart");
  await expect(reaction(chapterBar(page), "Heart: 1 reaction")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Lovely");
  await page.getByRole("button", { name: en.comments.submit }).click();
  await expect(page.getByText("Lovely")).toBeVisible();
  // One's own comment takes no reactions, so it has no bar at all.
  await expect(commentBar(page, "Dave")).toHaveCount(0);

  const erin = await loginAs(browser, "erin");
  await erin.page.goto(CHAPTER);
  await reaction(chapterBar(erin.page), "Heart: 1 reaction").click();
  await expect(
    reaction(chapterBar(erin.page), "Heart: 2 reactions"),
  ).toHaveAttribute("aria-pressed", "true");
  await pick(erin.page, commentBar(erin.page, "Dave"), "fire");
  await expect(
    reaction(commentBar(erin.page, "Dave"), "Fire: 1 reaction"),
  ).toHaveAttribute("aria-pressed", "true");
  await chapterBar(erin.page)
    .getByRole("button", { name: "Who reacted: Heart" })
    .click();
  const list = erin.page.getByRole("list", { name: en.reactions.who });
  await expect(list.getByRole("link", { name: "Erin" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Dave" })).toBeVisible();
  await erin.page.keyboard.press("Escape");
  await erin.context.close();

  // Another reaction replaces Dave's; the same one again takes it off.
  await page.reload();
  await pick(page, chapterBar(page), "laugh");
  await expect(
    reaction(chapterBar(page), "Laughing: 1 reaction"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(reaction(chapterBar(page), "Heart: 1 reaction")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await reaction(chapterBar(page), "Laughing: 1 reaction").click();
  await expect(
    chapterBar(page).getByRole("button", { name: /^Laughing/ }),
  ).toHaveCount(0);
  await expect(
    chapterBar(page).getByRole("button", { name: en.reactions.add }),
  ).toBeFocused();

  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guest.newPage();
  await guestPage.setViewportSize({ width: 375, height: 800 });
  await guestPage.goto(CHAPTER);
  await expect(
    reaction(chapterBar(guestPage), "Heart: 1 reaction"),
  ).toBeVisible();
  await expect(
    reaction(commentBar(guestPage, "Dave"), "Fire: 1 reaction"),
  ).toBeVisible();
  await expect(guestPage.getByText(/^\d+ reactions?$/)).toHaveCount(0);
  expect(
    await guestPage.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await chapterBar(guestPage)
    .getByRole("button", { name: "Who reacted: Heart" })
    .click();
  await expect(
    guestPage
      .getByRole("list", { name: en.reactions.who })
      .getByRole("link", { name: "Erin" }),
  ).toBeVisible();
  await guestPage.keyboard.press("Escape");
  await reaction(chapterBar(guestPage), "Heart: 1 reaction").click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guestPage.keyboard.press("Escape");
  await expect(
    reaction(chapterBar(guestPage), "Heart: 1 reaction"),
  ).toBeFocused();
  await commentBar(guestPage, "Dave")
    .getByRole("button", { name: en.reactions.add })
    .click();
  await expect(
    guestPage.getByRole("dialog", { name: en.auth.signIn }),
  ).toBeVisible();
  await guest.close();
});
