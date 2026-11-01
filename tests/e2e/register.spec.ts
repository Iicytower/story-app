import type { Page } from "@playwright/test";
import { PASSWORD_REQUIREMENTS } from "@/lib/credentials";
import { USERS } from "./env";
import { expect, test } from "./helpers";

const PASSWORD = "Dave-password-123456";

async function fillForm(
  page: Page,
  nickname: string,
  password: string,
  repeated = password,
) {
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Repeat password").fill(repeated);
}

function submit(page: Page) {
  return page.getByRole("button", { name: "Create account" }).click();
}

const alert = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

test.beforeEach(async ({ page }) => {
  await page.goto("/register");
});

test("/login and /register link to each other", async ({ page }) => {
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/login");
  await page.getByRole("link", { name: "Create one" }).click();
  await expect(page).toHaveURL("/register");
});

test("registering signs in and shows an empty account", async ({ page }) => {
  await fillForm(page, "Dave", PASSWORD);
  await submit(page);

  await expect(page).toHaveURL("/stories");
  await expect(page.getByRole("button", { name: "New story" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("requirements update live, one by one", async ({ page }) => {
  const list = page.getByRole("list", { name: "Password requirements" });
  const items = list.getByRole("listitem");
  await expect(items).toHaveText(
    PASSWORD_REQUIREMENTS.map((requirement) => `Missing: ${requirement}`),
  );

  await page.getByLabel("Password", { exact: true }).fill("abc");
  await expect(items.nth(1)).toHaveText(`Met: ${PASSWORD_REQUIREMENTS[1]}`);
  await expect(items.nth(2)).toHaveText(`Missing: ${PASSWORD_REQUIREMENTS[2]}`);

  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await expect(items).toHaveText(
    PASSWORD_REQUIREMENTS.map((requirement) => `Met: ${requirement}`),
  );
});

test("a weak password is refused by the server", async ({ page }) => {
  await fillForm(page, "Dave", "too-weak");
  await submit(page);

  await expect(alert(page)).toHaveText(/at least 17/);
  await expect(page).toHaveURL("/register");
  await expect(page.getByLabel("Nickname")).toHaveValue("Dave");
});

test("different passwords give a message without a request", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  await fillForm(page, "Dave", PASSWORD, `${PASSWORD}x`);
  await submit(page);

  await expect(alert(page)).toHaveText("The passwords do not match.");
  expect(posts).toEqual([]);
});

test("a taken nickname gives a message in any case", async ({ page }) => {
  await fillForm(page, USERS.alice.nickname.toUpperCase(), PASSWORD);
  await submit(page);

  await expect(alert(page)).toHaveText("This nickname is already taken.");
  await expect(page).toHaveURL("/register");
});

test("the page says the password cannot be recovered", async ({ page }) => {
  await expect(page.getByText("There is no password recovery.")).toBeVisible();
});
