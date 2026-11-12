import type { Page } from "@playwright/test";
import en from "@/messages/en.json";
import { storageStatePath } from "./env";
import {
  countActionRequests,
  expect,
  hideTab,
  loginAs,
  openSettings,
  test,
} from "./helpers";

const THREAD_POLL_MS = 5_000;

const messagesLink = (page: Page, unread = 0) =>
  page.getByRole("navigation", { name: en.sidebar.mainNav }).getByRole("link", {
    name:
      unread === 0
        ? en.sidebar.messages
        : `Messages, ${unread} unread conversation${unread > 1 ? "s" : ""}`,
    exact: true,
  });

async function writeFromProfile(page: Page, nickname: string, text: string) {
  await page.goto(`/en/p/${nickname}`);
  await page.getByRole("button", { name: en.profile.message }).click();
  const dialog = page.getByRole("dialog", { name: `Message to ${nickname}` });
  await dialog.getByRole("textbox", { name: en.messages.newLabel }).fill(text);
  await dialog.getByRole("button", { name: en.messages.send }).click();
  return dialog;
}

test.describe("a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("gets the sign-in dialog from Message (criterion 7)", async ({
    page,
  }) => {
    await page.goto("/en/p/Erin");
    await page.getByRole("button", { name: en.profile.message }).click();
    await expect(
      page.getByRole("dialog", { name: en.auth.signIn }),
    ).toBeVisible();
  });
});

test.describe("signed in", () => {
  test.use({ storageState: storageStatePath("dave") });

  test("dave writes to erin, erin answers and dave sees it after polling (6)", async ({
    page,
    browser,
  }) => {
    await page.clock.install();
    await writeFromProfile(
      page,
      "Erin",
      "Hello **Erin**, a verylongwordwithoutanyspacesthatmustwrapinsteadofoverflowingthethreadcolumn",
    );
    await expect(page).toHaveURL(/\/en\/messages\/[0-9a-f]{24}$/);
    const thread = page.getByRole("log", { name: en.messages.thread });
    await expect(thread.locator("strong")).toHaveText("Erin");

    const erin = await loginAs(browser, "erin");
    await erin.page.goto("/en/messages");
    await expect(messagesLink(erin.page, 1)).toBeVisible();
    await erin.page
      .getByRole("list", { name: en.messages.list })
      .getByRole("link", { name: /Dave/ })
      .click();
    await expect(
      erin.page.getByRole("heading", { name: "Conversation with Dave" }),
    ).toBeVisible();
    // Opening it reads it: the counter goes away.
    await expect(messagesLink(erin.page)).toBeVisible();
    await erin.page
      .getByRole("textbox", { name: en.messages.newLabel })
      .fill("Hi Dave");
    await erin.page.getByRole("button", { name: en.messages.send }).click();
    await expect(erin.page.getByRole("log").getByText("Hi Dave")).toBeVisible();

    await expect(thread.getByText("Hi Dave")).toBeHidden();
    await page.clock.runFor(THREAD_POLL_MS);
    await expect(thread.getByText("Hi Dave")).toBeVisible();

    // In the background the thread does not poll.
    await hideTab(page);
    const requests = countActionRequests(page);
    await erin.page
      .getByRole("textbox", { name: en.messages.newLabel })
      .fill("Are you there?");
    await erin.page.getByRole("button", { name: en.messages.send }).click();
    await expect(
      erin.page.getByRole("log").getByText("Are you there?"),
    ).toBeVisible();
    await page.clock.runFor(THREAD_POLL_MS * 3);
    expect(requests).toEqual([]);
    await expect(thread.getByText("Are you there?")).toBeHidden();
    await erin.context.close();
  });

  test("erin accepts no new conversations; dave is refused (2)", async ({
    browser,
    page,
  }) => {
    const erin = await loginAs(browser, "erin");
    await erin.page.goto("/en/books");
    const dialog = await openSettings(erin.page);
    const nobody = dialog
      .getByRole("group", { name: en.settings.dmFrom })
      .getByLabel(en.settings.dmFromOptions.nobody);
    await nobody.check();
    await expect(nobody).toBeChecked();
    // Saved at once: it is still chosen when the dialog opens again.
    await erin.page.reload();
    await expect(
      (await openSettings(erin.page))
        .getByRole("group", { name: en.settings.dmFrom })
        .getByLabel(en.settings.dmFromOptions.nobody),
    ).toBeChecked();
    await erin.context.close();

    const composer = await writeFromProfile(page, "Erin", "Hello");
    await expect(composer.getByRole("alert")).toHaveText(
      en.errors.interactionNotAllowed,
    );
    await expect(page).toHaveURL("/en/p/Erin");
  });
});

test.describe("new message", () => {
  test.use({ storageState: storageStatePath("dave") });

  test("starts a conversation from the messages page with a suggested nickname", async ({
    page,
  }) => {
    await page.goto("/en/messages");
    await page.getByRole("button", { name: en.messages.new }).click();
    const dialog = page.getByRole("dialog", { name: en.messages.new });
    const recipient = dialog.getByRole("combobox", {
      name: en.messages.recipient,
    });
    await recipient.fill("Er");
    await dialog.getByRole("option", { name: "Erin" }).click();
    await expect(recipient).toHaveValue("Erin");
    await dialog
      .getByRole("textbox", { name: en.messages.newLabel })
      .fill("Hello from the messages page");
    await dialog.getByRole("button", { name: en.messages.send }).click();
    await expect(page).toHaveURL(/\/en\/messages\/[0-9a-f]{24}$/);
    await expect(
      page.getByRole("log").getByText("Hello from the messages page"),
    ).toBeVisible();
  });

  test("an unknown nickname shows an error", async ({ page }) => {
    await page.goto("/en/messages");
    await page.getByRole("button", { name: en.messages.new }).click();
    const dialog = page.getByRole("dialog", { name: en.messages.new });
    await dialog
      .getByRole("combobox", { name: en.messages.recipient })
      .fill("NoSuchUser");
    await dialog
      .getByRole("textbox", { name: en.messages.newLabel })
      .fill("Hello?");
    await dialog.getByRole("button", { name: en.messages.send }).click();
    await expect(dialog.getByRole("alert")).toHaveText(en.errors.userNotFound);
  });
});
