import type { Page } from "@playwright/test";
import { PASSWORD_REQUIREMENTS } from "@/lib/credentials";
import { restorePassword } from "./db";
import { USERS } from "./env";
import { expect, expectSignedOut, login, sidebarAction, test } from "./helpers";

const NEW_PASSWORD = "Carol-new-password-678";

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
  await sidebarAction(page, "Change password");
});

test("the dialog lists the password requirements at the new password field", async ({
  page,
}) => {
  const field = page.getByLabel("New password", { exact: true });
  await expect(page.getByLabel("Current password")).toBeFocused();
  const requirements = page.getByRole("dialog").getByRole("list");
  await expect(requirements.getByRole("listitem")).toHaveText(
    PASSWORD_REQUIREMENTS,
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
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // The menu still responds after the dialog, and this session outlives the change.
  await page.reload();
  await expect(page).toHaveURL("/");
  await sidebarAction(page, "Log out");
  await expectSignedOut(page);

  await signIn(page, USERS.carol.password);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Invalid nickname or password." }),
  ).toBeVisible();

  await signIn(page, NEW_PASSWORD);
  await expect(page).toHaveURL("/");
});

test("closing the dialog clears what was typed", async ({ page }) => {
  await page.getByLabel("Current password").fill("typed");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await sidebarAction(page, "Change password");
  await expect(page.getByLabel("Current password")).toHaveValue("");
});
