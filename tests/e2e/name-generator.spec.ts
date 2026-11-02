import type { Page } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

async function openTile(page: Page) {
  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Tools" })
    .click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Name generator" })
    .click();
}

async function openGenerator(page: Page) {
  const story = await seedStory("alice", {
    title: "Names",
    content: "Text",
  });
  await page.goto(`/stories/${story}`);
  await openTile(page);
  const dialog = page.getByRole("dialog", { name: "Name generator" });
  await expect(dialog.getByRole("button", { name: "Generate" })).toBeVisible();
  return dialog;
}

const choice = (
  dialog: ReturnType<Page["getByRole"]>,
  group: string,
  name: string,
) =>
  dialog
    .getByRole("group", { name: group, exact: true })
    .getByRole("button", { name, exact: true });

const shownNames = (dialog: ReturnType<Page["getByRole"]>) =>
  dialog
    .getByRole("list", { name: "Names" })
    .getByRole("listitem")
    .locator("span")
    .allTextContents();

test("Generate shows 10 names and Next 10 replaces them with new ones", async ({
  page,
}) => {
  const dialog = await openGenerator(page);
  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(
    dialog.getByRole("list", { name: "Names" }).getByRole("listitem"),
  ).toHaveCount(10);
  const first = await shownNames(dialog);
  expect(new Set(first).size).toBe(10);

  await dialog.getByRole("button", { name: "Next 10" }).click();
  await expect
    .poll(async () => (await shownNames(dialog)).join())
    .not.toBe(first.join());
  const second = await shownNames(dialog);
  expect(second).toHaveLength(10);
  expect(second.filter((name) => first.includes(name))).toEqual([]);
});

test("Copy takes one name and Copy all takes the whole list", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const dialog = await openGenerator(page);
  await dialog.getByRole("button", { name: "Generate" }).click();
  const list = dialog.getByRole("list", { name: "Names" });
  await expect(list.getByRole("listitem")).toHaveCount(10);
  const names = await shownNames(dialog);
  const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

  await dialog.getByRole("button", { name: `Copy ${names[2]}` }).click();
  await expect.poll(clipboard).toBe(names[2]);

  await expect(dialog.getByRole("button", { name: "Copy all" })).toHaveText(
    "Copy all",
  );
  await dialog.getByRole("button", { name: "Copy all" }).click();
  await expect.poll(clipboard).toBe(names.join("\n"));
});

test("Sound works as a radio group and Gender needs a type with a first name", async ({
  page,
}) => {
  const dialog = await openGenerator(page);
  await choice(dialog, "Sound", "Hard").click();
  await expect(choice(dialog, "Sound", "Hard")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await choice(dialog, "Sound", "Soft").click();
  await expect(choice(dialog, "Sound", "Soft")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(choice(dialog, "Sound", "Hard")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await expect(dialog.getByRole("group", { name: "Gender" })).toBeVisible();
  await choice(dialog, "Places", "City").click();
  await expect(dialog.getByRole("group", { name: "Gender" })).toBeHidden();
});

test("a conflicting value is marked before the click and clears the other one", async ({
  page,
}) => {
  const dialog = await openGenerator(page);
  const heavy = choice(dialog, "Letter balance", "Vowel-heavy");
  await expect(heavy).not.toHaveCSS("border-style", "dashed");

  await choice(dialog, "Pronunciation", "Unpronounceable").click();
  await expect(heavy).toHaveCSS("border-style", "dashed");
  await expect(heavy).toHaveAttribute("title", "Clears Unpronounceable");

  await heavy.click();
  await expect(heavy).toHaveAttribute("aria-pressed", "true");
  await expect(
    choice(dialog, "Pronunciation", "Unpronounceable"),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(choice(dialog, "Pronunciation", "Any")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const radius = (name: string, group: string) =>
    choice(dialog, group, name).evaluate(
      (element) => getComputedStyle(element).borderTopLeftRadius,
    );
  expect(await radius("Hard", "Sound")).not.toBe(
    await radius("Elvish", "Style"),
  );
});

test("text filters without results show a message", async ({ page }) => {
  const dialog = await openGenerator(page);
  await dialog.getByLabel("Starts with").fill("a");
  await dialog.getByLabel("Excludes (comma-separated)").fill("a");
  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "No names match these filters.",
  );
});

test("filters come back after a reload", async ({ page }) => {
  const dialog = await openGenerator(page);
  await choice(dialog, "Sound", "Hard").click();
  await dialog.getByLabel("Contains").fill("kar");

  await page.reload();
  await openTile(page);
  await expect(choice(dialog, "Sound", "Hard")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog.getByLabel("Contains")).toHaveValue("kar");
});

test("generating sends no requests", async ({ page }) => {
  const dialog = await openGenerator(page);
  // The editor's own start-up calls are not the generator's.
  await page.waitForLoadState("networkidle");
  const requests: string[] = [];
  page.on("request", (request) => {
    // Rendering the list may fetch a font file; that is static, not application data.
    if (new URL(request.url()).pathname.startsWith("/_next/static/")) return;
    requests.push(`${request.method()} ${request.url()}`);
  });

  await dialog.getByRole("button", { name: "Generate" }).click();
  await expect(
    dialog.getByRole("list", { name: "Names" }).getByRole("listitem"),
  ).toHaveCount(10);
  await dialog.getByRole("button", { name: "Next 10" }).click();
  await expect(
    dialog.getByRole("list", { name: "Names" }).getByRole("listitem"),
  ).toHaveCount(10);
  expect(requests).toEqual([]);
});
