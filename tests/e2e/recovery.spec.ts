import type { Page } from "@playwright/test";
import { expect, expectSignedOut, logOut, test } from "./helpers";

const PASSWORD = "Willow-lantern-2468!";
const NEW_PASSWORD = "Harbor-candle-9753!";

async function openDialog(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Log in / Create account" }).click();
  return page.getByRole("dialog");
}

async function saveCodes(page: Page): Promise<string[]> {
  const dialog = page.getByRole("dialog", { name: "Save your recovery codes" });
  const items = dialog
    .getByRole("list", { name: "Recovery codes" })
    .getByRole("listitem");
  await expect(items).toHaveCount(10);
  const codes = await items.allTextContents();
  await dialog.getByLabel("I have saved these codes").check();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  return codes;
}

async function signIn(page: Page, password: string) {
  const dialog = await openDialog(page);
  await dialog.getByLabel("Nickname").fill("Grace");
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Sign in" }).click();
}

async function reset(page: Page, code: string, password = NEW_PASSWORD) {
  const dialog = await openDialog(page);
  await dialog.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(dialog.getByRole("heading")).toHaveText(
    "Reset password with a recovery code",
  );
  await dialog.getByLabel("Nickname").fill("grace");
  await dialog.getByLabel("Recovery code").fill(code);
  await dialog.getByLabel("New password", { exact: true }).fill(password);
  await dialog.getByLabel("Repeat new password").fill(password);
  await dialog.getByRole("button", { name: "Set new password" }).click();
}

async function logOutAndCheck(page: Page) {
  await logOut(page);
  await expectSignedOut(page);
}

test("a forgotten password is reset with a recovery code, which then stops working", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await dialog.getByRole("button", { name: "Create one" }).click();
  await dialog.getByLabel("Nickname").fill("Grace");
  await dialog.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await dialog.getByLabel("Repeat password").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Create account" }).click();
  const codes = await saveCodes(page);
  await logOutAndCheck(page);

  // Typed by hand: lower case and without dashes.
  await reset(page, codes[4].toLowerCase().replace(/-/g, " "));
  await expect(
    page.getByText("Your password is changed and the code you used"),
  ).toBeVisible();
  const fresh = await saveCodes(page);
  expect(fresh).toHaveLength(10);
  expect(fresh).not.toContain(codes[4]);
  await logOutAndCheck(page);

  await signIn(page, PASSWORD);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Invalid nickname or password." }),
  ).toBeVisible();
  await signIn(page, NEW_PASSWORD);
  await expect(page).toHaveURL("/en");
  await logOutAndCheck(page);

  await reset(page, codes[4], PASSWORD);
  await expect(
    page.getByRole("alert").filter({ hasText: /recovery code is not valid/ }),
  ).toBeVisible();
});
