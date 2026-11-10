import {
  type Browser,
  expect,
  test as base,
  type Locator,
  type Page,
} from "@playwright/test";
import { createTranslator } from "next-intl";
import { AUTOSAVE_DELAY_MS } from "@/lib/autosave";
import {
  PASSWORD_REQUIREMENT_VALUES,
  PASSWORD_REQUIREMENTS,
} from "@/lib/credentials";
import en from "@/messages/en.json";
import { clearStories } from "./db";
import { storageStatePath, USERS, type UserName } from "./env";

const password = createTranslator({
  locale: "en",
  messages: en,
  namespace: "password",
});

// The requirement texts as the English interface shows them.
export const PASSWORD_REQUIREMENT_TEXTS = PASSWORD_REQUIREMENTS.map((id) =>
  password(`requirements.${id}`, PASSWORD_REQUIREMENT_VALUES),
);

export async function login(page: Page, user: UserName) {
  await page.goto("/?auth=login");
  await page.getByLabel("Nickname").fill(USERS[user].nickname);
  await page.getByLabel("Password").fill(USERS[user].password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/en");
}

// A second user in the same test: their own context with the saved session. The caller
// closes the context; the CSP fixture does not watch it.
export async function loginAs(browser: Browser, user: UserName) {
  const context = await browser.newContext({
    storageState: storageStatePath(user),
  });
  return { context, page: await context.newPage() };
}

export const test = base.extend<{ cleanStories: void }>({
  cleanStories: [
    async ({}, use) => {
      await clearStories();
      await use();
    },
    { auto: true },
  ],
  // Any Content-Security-Policy violation on a page of the test's context fails the test
  // (task 60, D77). Contexts a test opens itself are not covered.
  // Not "use": the React Hooks lint rule takes it for the hook.
  // A test lists violations it expects with allowCspViolation.
  context: async ({ context }, run, testInfo) => {
    const violations: string[] = [];
    await context.exposeBinding("__reportCspViolation", (_, text: string) => {
      violations.push(text);
    });
    await context.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const report = (
          window as unknown as {
            __reportCspViolation: (text: string) => void;
          }
        ).__reportCspViolation;
        report(`${event.effectiveDirective} ${event.blockedURI}`);
      });
    });
    await run(context);
    const allowed = testInfo.annotations
      .filter(({ type }) => type === CSP_ALLOWED)
      .map(({ description }) => description);
    expect(
      violations.filter((violation) => !allowed.includes(violation)),
      "Content-Security-Policy violations",
    ).toEqual([]);
  },
});

export { expect };

const CSP_ALLOWED = "csp-allowed";

// For violations that are the policy doing its job, e.g. "script-src-attr inline". Each caller
// says why the blocked code is harmless.
export function allowCspViolation(violation: string) {
  test.info().annotations.push({ type: CSP_ALLOWED, description: violation });
}

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

// Views and the settings live in the sidebar, a drawer on narrow screens.
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

// Opens the settings dialog from the sidebar (D50).
export async function openSettings(page: Page) {
  await sidebarAction(page, "Settings");
  return page.getByRole("dialog", { name: "Settings" });
}

// Picks a theme in the settings dialog and saves it; the dialog stays open.
export async function saveTheme(
  page: Page,
  theme: "Light" | "Dark" | "System",
) {
  const dialog = await openSettings(page);
  await dialog.getByLabel("Theme").selectOption({ label: theme });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

// Right after a load the trigger may not be hydrated yet, so the click is repeated until
// the menu shows.
export async function openMenu(trigger: Locator) {
  const page = trigger.page();
  await expect(async () => {
    if ((await page.getByRole("menu").count()) === 0) await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
  }).toPass();
}

// Opens a ⋮ menu by its label (D55) and picks an item; `scope` narrows it to a row.
export async function menuAction(
  page: Page,
  menu: string,
  item: string,
  scope: Pick<Page, "getByRole"> = page,
) {
  await openMenu(scope.getByRole("button", { name: menu, exact: true }));
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
}

// The first ⋮ menu on the page: the editor's top bar or the folder header.
export async function editorAction(page: Page, item: string) {
  await openMenu(page.getByRole("button", { name: /^Actions for/ }).first());
  await page.getByRole("menuitem", { name: item, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
}

export async function publishFromEditor(page: Page) {
  await editorAction(page, "Publish");
  await page
    .getByRole("alertdialog", { name: "Publish chapter?" })
    .getByRole("button", { name: "Publish", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
}

// Picks a sort option from the "Sort" submenu of a ⋮ menu.
export async function sortBy(page: Page, menu: string, option: string) {
  await openMenu(page.getByRole("button", { name: menu, exact: true }));
  await page.getByRole("menuitem", { name: "Sort", exact: true }).hover();
  await page.getByRole("menuitemradio", { name: option, exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
}

// Selects to the start of the line. ProseMirror copies the DOM selection into its state on
// the asynchronous selectionchange event; a shortcut pressed before it acts on the old caret.
export async function selectToLineStart(page: Page) {
  const changed = page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        document.addEventListener(
          "selectionchange",
          () => setTimeout(resolve),
          {
            once: true,
          },
        ),
      ),
  );
  await page.keyboard.press("Shift+Home");
  await changed;
}
