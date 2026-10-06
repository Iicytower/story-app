import { expect, test as base, type Page } from "@playwright/test";
import { clearStories } from "./db";
import { USERS, type UserName } from "./env";

export async function login(page: Page, user: UserName) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(USERS[user].email);
  await page.getByLabel("Password").fill(USERS[user].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/stories");
}

export const test = base.extend<{ cleanStories: void }>({
  cleanStories: [
    async ({}, use) => {
      await clearStories();
      await use();
    },
    { auto: true },
  ],
});

export { expect };
