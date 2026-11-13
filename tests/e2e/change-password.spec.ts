import type { Page } from "@playwright/test";
import { restorePassword } from "./db";
import { USERS } from "./env";
import {
  expect,
  expectSignedOut,
  login,
  PASSWORD_REQUIREMENT_TEXTS,
  logOut,
  openSettings,
  test,
} from "./helpers";

const NEW_PASSWORD = "Meadow-new-secret-678";

async function submitPasswords(
  page: Page,
  current: string,
  next: string,
  repeated = next,
) {
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Repeat new password").fill(repeated);
  await page.getByRole("button", { name: "Save" }).click();
}

async function signIn(page: Page, password: string) {
  await page.goto("/?auth=login");
  await page.getByLabel("Nickname").fill(USERS.carol.nickname);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.beforeEach(async ({ page }) => {
  await restorePassword("carol");
  await login(page, "carol");
  const settings = await openSettings(page, "Account");
  await settings.getByRole("button", { name: "Change password" }).click();
});

test("the dialog lists the password requirements at the new password field", async ({
  page,
}) => {
  const field = page.getByLabel("New password", { exact: true });
  await expect(page.getByLabel("Current password")).toBeFocused();
  const requirements = page.getByRole("dialog").getByRole("list");
  await expect(requirements.getByRole("listitem")).toHaveText(
    PASSWORD_REQUIREMENT_TEXTS,
  );
  await expect(field).toHaveAccessibleDescription(/17-256 characters/);
});

test("a wrong current, weak or mismatched password shows a message", async ({
  page,
}) => {
  const alert = page.getByRole("alert").filter({ hasText: /\S/ });

  await submitPasswords(page, "Wrong-password-12345", NEW_PASSWORD);
  await expect(alert).toHaveText("The current password is incorrect.");

  await submitPasswords(page, USERS.carol.password, "too-short");
  await expect(alert).toHaveText(
    "Password must be at least 17 characters long.",
  );

  await submitPasswords(page, USERS.carol.password, NEW_PASSWORD, "different");
  await expect(alert).toHaveText("The new passwords do not match.");
});

test("after the change only the new password signs in", async ({ page }) => {
  await submitPasswords(page, USERS.carol.password, NEW_PASSWORD);
  await expect(page.getByRole("status")).toHaveText(
    "Your password has been changed.",
  );
  // Close goes back to the settings.
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // The menu still responds after the dialog, and this session outlives the change.
  await page.reload();
  await expect(page).toHaveURL("/en");
  await logOut(page);
  await expectSignedOut(page);

  await signIn(page, USERS.carol.password);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Invalid nickname or password." }),
  ).toBeVisible();

  await signIn(page, NEW_PASSWORD);
  await expect(page).toHaveURL("/en");
});

test("Cancel goes back to the settings and clears what was typed", async ({
  page,
}) => {
  await page.getByLabel("Current password").fill("typed");
  await page.getByRole("button", { name: "Cancel" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(
    settings.getByRole("tabpanel", { name: "Account", exact: true }),
  ).toBeVisible();

  await settings.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByLabel("Current password")).toHaveValue("");

  // Closing the whole dialog starts from the settings next time.
  await page.getByLabel("Current password").fill("typed");
  await page.keyboard.press("Escape");
  await openSettings(page, "Account");
  await expect(
    settings.getByRole("tabpanel", { name: "Account", exact: true }),
  ).toBeVisible();
});
