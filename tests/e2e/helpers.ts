import { expect, test as base, type Page } from "@playwright/test";
import { AUTOSAVE_DELAY_MS } from "@/lib/autosave";
import { clearStories } from "./db";
import { USERS, type UserName } from "./env";

export async function login(page: Page, user: UserName) {
  await page.goto("/?auth=login");
  await page.getByLabel("Nickname").fill(USERS[user].nickname);
  await page.getByLabel("Password").fill(USERS[user].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/en");
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

// A sign-out from "/" keeps the address, so the URL alone does not show that it finished.
export async function expectSignedOut(page: Page) {
  await expect(
    page.getByRole("button", { name: "Log in / Create account" }),
  ).toBeVisible();
}

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

// Autosave waits 20 s: tests call page.clock.install() before opening the page and skip ahead.
export async function runAutosaveDelay(page: Page, ms = AUTOSAVE_DELAY_MS) {
  await page.clock.runFor(ms);
}

// Emulates switching to another tab, which saves right away.
export async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

// Server Action calls made by the page, e.g. to check that nothing was saved.
export function countActionRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.headers()["next-action"]) requests.push(request.url());
  });
  return requests;
}

// Views, the theme and logging out live in the sidebar, a drawer on narrow screens.
export async function sidebarAction(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  // The drawer of a previous action may still be animating away.
  await expect(page.getByRole("dialog")).toBeHidden();
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole(name === "Folders" ? "link" : "button", { name, exact: true })
    .click();
}
