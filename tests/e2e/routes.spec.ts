import en from "@/messages/en.json";
import { findFolder, seedPublished, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, loginAs, sidebarAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

async function seedChapter(user: "alice" | "bob", folder: string) {
  const chapter = await seedStory(user, { title: "Routes", folder });
  const book = (await findFolder(folder))!._id.toString();
  return { book, chapter };
}

test("books, a book, a chapter and their exports have the new addresses", async ({
  page,
}) => {
  const { book, chapter } = await seedChapter("alice", "Routes book");
  for (const path of [
    "/en/books",
    `/en/books/${book}`,
    `/en/chapters/${chapter}`,
    `/books/${book}/export`,
    `/chapters/${chapter}/export`,
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(200);
  }
});

test("the old addresses give a 404 without a redirect to the new ones", async ({
  page,
}) => {
  const { book, chapter } = await seedChapter("alice", "Routes book");
  for (const path of [
    "/en/stories",
    `/en/folders/${book}`,
    `/en/stories/${chapter}`,
    `/stories/${chapter}/export`,
    `/folders/${book}/export`,
  ]) {
    const response = await page.goto(path);
    expect(response!.status(), path).toBe(404);
    expect(page.url(), path).not.toMatch(/\/(books|chapters)(\/|$)/);
  }
});

test("the sidebar, the list and the editor link to the new addresses", async ({
  page,
}) => {
  const { book, chapter } = await seedChapter("alice", "Routes book");
  await page.goto(`/en/chapters/${chapter}`);
  await sidebarAction(page, en.sidebar.folders);
  await expect(page).toHaveURL("/en/books");

  await page.getByRole("link", { name: /^Routes book/ }).click();
  await expect(page).toHaveURL(`/en/books/${book}`);

  await page.getByRole("link", { name: /^Routes(?! book)/ }).click();
  await expect(page).toHaveURL(`/en/chapters/${chapter}`);

  await page.getByRole("link", { name: "Routes book", exact: true }).click();
  await expect(page).toHaveURL(`/en/books/${book}`);
});

test("a notification leads to the public chapter page", async ({
  page,
  browser,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);
  const dave = await loginAs(browser, "dave");
  await dave.page.goto("/en/p/Alice/book/one");
  await dave.page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Hello");
  await dave.page.getByRole("button", { name: en.comments.submit }).click();
  await expect(dave.page.getByText("Hello")).toBeVisible();
  await dave.context.close();

  await page.goto("/en/books");
  await page
    .getByRole("button", { name: "Notifications, 1 unread", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: en.notifications.title })
    .getByRole("button", { name: /Dave commented on “One”/ })
    .click();
  await expect(page).toHaveURL(
    /\/en\/p\/Alice\/book\/one#comment-[0-9a-f]{24}$/,
  );
});

test("another user's book and chapter give a 404 at the new addresses", async ({
  page,
}) => {
  const { book, chapter } = await seedChapter("bob", "Bob routes");
  for (const path of [
    `/en/books/${book}`,
    `/en/chapters/${chapter}`,
    `/books/${book}/export`,
    `/chapters/${chapter}/export`,
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
});
