import type { Browser } from "@playwright/test";
import { clearSettings, findSettings, seedSettings } from "./db";
import { USERS, storageStatePath } from "./env";
import { expect, test } from "./helpers";

// Bob's language setting would otherwise leak into other tests that sign him in.
test.afterEach(() => clearSettings("bob"));

async function signedIn(browser: Browser, locale?: string) {
  const context = await browser.newContext({
    storageState: storageStatePath("bob"),
    locale,
  });
  return context.newPage();
}

test("switching to Polish keeps the page, survives a reload and is saved", async ({
  browser,
}) => {
  const page = await signedIn(browser);
  await page.goto("/en/stories?q=dragon");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name: "Language" })
    .click();
  await page.getByRole("menuitemradio", { name: "Polski" }).click();

  await expect(page).toHaveURL("/pl/stories?q=dragon");
  await expect(page.locator("html")).toHaveAttribute("lang", "pl");
  await expect(
    page.getByRole("searchbox", { name: "Szukaj opowiadań" }),
  ).toBeVisible();
  expect((await findSettings("bob"))?.appearance).toMatchObject({
    locale: "pl",
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Foldery" })).toBeVisible();
  // An address without a locale follows the cookie set by the switch.
  await page.goto("/stories");
  await expect(page).toHaveURL("/pl/stories");

  await page
    .getByRole("navigation", { name: "Główna" })
    .getByRole("button", { name: "Wyloguj", exact: true })
    .click();
  await expect(page).toHaveURL("/pl");
  await page.goto("/");
  await expect(page).toHaveURL("/pl");
  await expect(
    page.getByRole("button", { name: "Zaloguj się / Załóż konto" }),
  ).toBeVisible();
  await page.context().close();
});

test("signing in on another device brings the saved language", async ({
  browser,
}) => {
  await seedSettings("bob", { appearance: { locale: "pl" } });
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/stories");
  await expect(page).toHaveURL(/^[^?]*\/en\?callbackUrl=/);

  await page.getByLabel("Nickname").fill(USERS.bob.nickname);
  await page.getByLabel("Password").fill(USERS.bob.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/pl/stories");
  await expect(page.getByRole("heading", { name: "Foldery" })).toBeVisible();

  // The cookie now holds the setting.
  await page.goto("/");
  await expect(page).toHaveURL("/pl");
  await context.close();
});

test("a visitor gets the language of the browser", async ({ browser }) => {
  const context = await browser.newContext({ locale: "pl-PL" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL("/pl");
  await expect(
    page.getByRole("heading", { name: "Szukaj opowiadań" }),
  ).toBeVisible();
  await context.close();
});

test("a Server Action error is in Polish on /pl", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-US" });
  const page = await context.newPage();
  await page.goto("/pl?auth=login");
  await page.getByLabel("Nick").fill(USERS.bob.nickname);
  await page.getByLabel("Hasło").fill("wrong-password");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Nieprawidłowy nick lub hasło.",
  );
  await context.close();
});

test("a signed-in action error is in Polish on /pl", async ({ browser }) => {
  const page = await signedIn(browser);
  await page.goto("/pl/stories");
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await page.getByRole("button", { name: "Utwórz" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Nazwa folderu jest wymagana.",
  );
  await page.context().close();
});
