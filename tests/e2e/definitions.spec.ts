import type { Page } from "@playwright/test";
import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, hideTab, markdownEditor, test } from "./helpers";

// Answers come from fake-tools.mjs: kot (with a dialect sense), ten and tego (only "od: ten"),
// "kota" and "tego" are forms of them; AWARIA fails, POWOLI answers after 4 s.

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

function sidebarTab(page: Page, name: string) {
  return page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name });
}

async function openDefinitions(page: Page) {
  await sidebarTab(page, "Tools").click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Definitions" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Definitions" });
  return {
    dialog,
    word: dialog.getByRole("textbox", { name: "Word" }),
    search: async (word: string) => {
      await dialog.getByRole("textbox", { name: "Word" }).fill(word);
      await dialog.getByRole("button", { name: "Look up" }).click();
    },
  };
}

async function openStory(page: Page, content = "Ala ma kota.") {
  const id = await seedStory("alice", { title: "Words", content });
  await page.goto(`/stories/${id}`);
  return id;
}

test("an inflected form shows the senses of its lemma, with links and sources", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("kota");

  const results = dialog.getByRole("region", {
    name: "Definitions of “kota”",
  });
  const kot = results.getByRole("region", {
    name: "Shown for: kot",
    exact: true,
  });
  await expect(kot).toBeVisible();
  await expect(kot.getByText("noun")).toBeVisible();
  await expect(kot.getByRole("listitem")).toHaveText([
    "1.1zwierzę domoweKot goni za myszą.",
    "1.4colloquialkłąb kurzu",
    // Dialect senses come last, with the region in the label.
    "1.6dialect (Kaszuby)kotwica",
  ]);
  const entryLink = kot.getByRole("link", { name: /Wikisłownik/ });
  await expect(entryLink).toHaveAttribute(
    "href",
    "https://pl.wiktionary.org/wiki/kot",
  );
  await expect(entryLink).toHaveAttribute("target", "_blank");
  await expect(entryLink.locator("xpath=..")).toHaveText(
    "Wikisłownik(opens in a new tab), CC BY-SA 4.0",
  );

  for (const [name, href] of [
    ["sjp.pl", "https://sjp.pl/kota"],
    ["PWN", "https://sjp.pwn.pl/slowniki/kota.html"],
  ]) {
    const link = dialog.getByRole("link", { name });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveAttribute("target", "_blank");
  }

  // Every group links its own entry (criterion 3).
  const name = results.getByRole("region", {
    name: "Shown for: Kot",
    exact: true,
  });
  await expect(name.getByText("proper noun")).toBeVisible();
  await expect(name.getByRole("link", { name: /Wikisłownik/ })).toHaveAttribute(
    "href",
    "https://pl.wiktionary.org/wiki/Kot",
  );

  const sources = dialog.getByRole("region", { name: "Sources" });
  await expect(sources.getByRole("listitem")).toHaveText([
    /^Wikisłownik, CC BY-SA 4\.0\. Changed: labels/,
    "PoliMorf, BSD 2-Clause",
  ]);
});

test("a form that only points to its lemma is not shown on its own", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("tego");
  const results = dialog.getByRole("region", {
    name: "Definitions of “tego”",
  });
  await expect(
    results.getByRole("region", { name: "Shown for: ten" }),
  ).toBeVisible();
  await expect(results.getByText("od: ten")).toHaveCount(0);
});

test("no result gives a message and keeps the links", async ({ page }) => {
  await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("xyzq");
  await expect(dialog.getByRole("status")).toHaveText(
    "No definitions found for “xyzq”.",
  );
  await expect(dialog.getByRole("link", { name: "sjp.pl" })).toHaveAttribute(
    "href",
    "https://sjp.pl/xyzq",
  );
  await expect(dialog.getByRole("region", { name: "Sources" })).toHaveCount(0);
});

test("the result stays after closing the dialog and switching tabs", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("kota");
  await expect(
    dialog.getByRole("region", { name: "Shown for: kot", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await sidebarTab(page, "Notes").click();
  const again = await openDefinitions(page);
  await expect(again.word).toHaveValue("kota");
  await expect(
    again.dialog.getByRole("region", { name: "Shown for: kot", exact: true }),
  ).toBeVisible();
});

test("a slow service ends the lookup after 2 s and autosave waits at most that long", async ({
  page,
}) => {
  const id = await openStory(page);
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Dalej");

  const { dialog, word, search } = await openDefinitions(page);
  await search("POWOLI");
  // Locked while the lookup runs (criterion 9).
  await expect(word).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Looking up…" }),
  ).toBeDisabled();
  // Switching away saves at once; the save waits behind the lookup.
  const started = Date.now();
  await hideTab(page);
  await expect
    .poll(async () => (await findStoryById(id))?.content, { timeout: 10_000 })
    .toBe("Ala ma kota. Dalej");
  // The fake answers after 4 s; the lookup gives up after 2 s.
  expect(Date.now() - started).toBeLessThan(3500);
  await expect(dialog.getByRole("alert")).toHaveText(
    "The dictionary did not answer in time. Try again.",
  );
  await expect(word).toBeEnabled();
});

test("an unavailable service and a lost Server Action give a message, and editing still saves", async ({
  page,
}) => {
  const id = await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("AWARIA");
  await expect(dialog.getByRole("alert")).toHaveText(
    "This tool is not available right now. Try again later.",
  );
  await expect(dialog.getByRole("link", { name: "PWN" })).toBeVisible();

  // After a deploy the old page's action id is unknown to the server.
  await page.route(`**/stories/${id}`, (route) =>
    route.request().headers()["next-action"]
      ? route.fulfill({ status: 404, body: "Server action not found." })
      : route.fallback(),
  );
  await search("kota");
  await expect(dialog.getByRole("alert")).toHaveText(
    "The lookup could not run. Reload the page and try again.",
  );
  await page.unrouteAll();

  await page.keyboard.press("Escape");
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await hideTab(page);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("Ala ma kota.!");
});

test("a dialog reopened during a lookup stays locked and shows the answer", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openDefinitions(page);
  await search("POWOLI");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const again = await openDefinitions(page);
  await expect(again.word).toBeDisabled();
  await expect(again.dialog.getByRole("alert")).toHaveText(
    "The dictionary did not answer in time. Try again.",
  );
  await expect(again.word).toBeEnabled();
});
