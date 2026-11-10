import type { Browser } from "@playwright/test";
import { restorePassword } from "./db";
import { USERS } from "./env";
import { expect, expectSignedOut, login, openSettings, test } from "./helpers";

// Carol only: ending sessions must not sign out the saved sessions other tests use.
async function device(browser: Browser) {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await login(page, "carol");
  return { context, page };
}

test.beforeEach(() => restorePassword("carol"));
test.afterEach(() => restorePassword("carol"));

test("changing the password in one browser signs out the other", async ({
  browser,
}) => {
  const here = await device(browser);
  const other = await device(browser);

  const settings = await openSettings(here.page);
  await settings.getByRole("button", { name: "Change password" }).click();
  await here.page.getByLabel("Current password").fill(USERS.carol.password);
  const next = "Meadow-new-secret-678";
  await here.page.getByLabel("New password", { exact: true }).fill(next);
  await here.page.getByLabel("Repeat new password").fill(next);
  await here.page.getByRole("button", { name: "Save" }).click();
  await expect(
    here.page.getByText("Your password has been changed."),
  ).toBeVisible();

  await other.page.goto("/stories");
  await expectSignedOut(other.page);
  await here.page.goto("/stories");
  await expect(here.page).toHaveURL("/en/stories");
});

test("Log out other devices keeps this one signed in", async ({ browser }) => {
  const here = await device(browser);
  const other = await device(browser);

  const settings = await openSettings(here.page);
  await settings.getByRole("button", { name: "Log out other devices" }).click();
  await here.page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Log out other devices" })
    .click();
  await expect(
    settings.getByText("Other devices are logged out."),
  ).toBeVisible();

  await other.page.goto("/stories");
  await expectSignedOut(other.page);
  await here.page.goto("/stories");
  await expect(here.page).toHaveURL("/en/stories");
});

test("a cookie copied before logging out does not work after it", async ({
  browser,
}) => {
  const here = await device(browser);
  const cookies = await here.context.cookies();

  const settings = await openSettings(here.page);
  await settings.getByRole("button", { name: "Log out", exact: true }).click();
  await expectSignedOut(here.page);

  const thief = await browser.newContext({
    storageState: { cookies, origins: [] },
  });
  const page = await thief.newPage();
  await page.goto("/stories");
  await expectSignedOut(page);
});
