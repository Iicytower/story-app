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

// The rich text editor has no value; tests read and write its markdown through Source mode.
export function markdownEditor(page: Page, label: string) {
  const group = page.getByRole("group", {
    name: `${label} editor`,
    exact: true,
  });
  const mode = (name: "Preview" | "Source") =>
    group.getByRole("button", { name, exact: true });
  return {
    field: page.getByRole("textbox", { name: label, exact: true }),
    group,
    button: (name: string) => group.getByRole("button", { name, exact: true }),
    async source(): Promise<string> {
      await mode("Source").click();
      const value = await group.getByRole("textbox").inputValue();
      await mode("Preview").click();
      return value;
    },
    async setSource(markdown: string) {
      await mode("Source").click();
      await group.getByRole("textbox").fill(markdown);
      await mode("Preview").click();
    },
  };
}
