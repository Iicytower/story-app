import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { seedPublished } from "./db";
import { expect, expectSignedOut, openSettings, test } from "./helpers";

const CHAPTER = "/en/p/Alice/book/one";
const PASSWORD = "Willow-lantern-2468!";

async function openRegistration(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in / Create account" }).click();
  await page.getByRole("button", { name: "Create one" }).click();
  await page.getByLabel("Nickname").fill("Frank");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("a new account comments, deletes itself and keeps its nickname taken", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public", content: "Chapter text" },
  ]);

  await openRegistration(page);
  const codes = page.getByRole("dialog", { name: "Save your recovery codes" });
  await codes.getByLabel("I have saved these codes").check();
  await codes.getByRole("button", { name: "Continue" }).click();

  await page.goto(CHAPTER);
  await page
    .getByRole("textbox", { name: en.comments.newLabel })
    .fill("Hello from Frank");
  await page.getByRole("button", { name: en.comments.submit }).click();
  const comments = page.getByRole("list", { name: en.comments.list });
  await expect(comments.getByRole("link", { name: "Frank" })).toBeVisible();

  await page.goto("/en/books");
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: en.settings.deleteAccount })
    .click();
  const form = page.getByRole("dialog", { name: en.deleteAccount.title });
  await form.getByLabel(en.deleteAccount.password).fill(PASSWORD);
  await form.getByLabel(en.deleteAccount.nickname).fill("Frankie");
  await form.getByRole("button", { name: en.deleteAccount.confirm }).click();
  await expect(form.getByRole("alert")).toHaveText(
    en.errors.deleteAccountNicknameMismatch,
  );

  await form.getByLabel(en.deleteAccount.nickname).fill("frank");
  await form.getByRole("button", { name: en.deleteAccount.confirm }).click();
  await expectSignedOut(page);

  await page.goto(CHAPTER);
  const item = comments.getByRole("listitem").first();
  await expect(item.getByText("Hello from Frank")).toBeVisible();
  await expect(item.getByText(en.comments.deletedUser)).toBeVisible();
  await expect(item.getByRole("link", { name: "Frank" })).toHaveCount(0);

  const profile = await page.goto("/en/p/Frank");
  expect(profile?.status()).toBe(404);

  await openRegistration(page);
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText(
    en.errors.nicknameTaken,
  );
});
