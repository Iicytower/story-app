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
    .getByRole("button", { name: "Settings" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Interface language").selectOption("pl");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL("/pl/stories?q=dragon");
  // The dialog stays open, now in Polish.
  await expect(
    dialog.getByRole("heading", { name: "Ustawienia" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Język interfejsu")).toHaveValue("pl");
  await expect(dialog.getByRole("button", { name: "Zapisz" })).toBeDisabled();
  for (const name of ["Wygląd", "Język", "Konto"])
    await expect(dialog.getByRole("region", { name })).toBeVisible();
  await expect(dialog.getByLabel("Motyw").locator("option")).toHaveText([
    "Jasny",
    "Ciemny",
    "Systemowy",
  ]);
  await expect(
    dialog.getByRole("button", { name: "Zmień hasło" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Anuluj" })).toBeVisible();
  await page.keyboard.press("Escape");
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
    .getByRole("button", { name: "Ustawienia" })
    .click();
  await page
    .getByRole("dialog", { name: "Ustawienia" })
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
  await page.getByRole("button", { name: "Akcje", exact: true }).click();
  await page.getByRole("menuitem", { name: "Nowy folder" }).click();
  await page.getByRole("button", { name: "Utwórz" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Nazwa folderu jest wymagana.",
  );
  await page.context().close();
});
