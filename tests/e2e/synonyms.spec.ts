import type { Page } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

// Answers come from fake-tools.mjs: kot in both sources ("sierściuch" in both, with different
// labels), pies only in the thesaurus; "kota" and "psa" are forms of them; AWARIA fails.

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

function sidebarTab(page: Page, name: string) {
  return page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name });
}

async function openSynonyms(page: Page) {
  await sidebarTab(page, "Tools").click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Synonyms" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Synonyms" });
  return {
    dialog,
    word: dialog.getByRole("textbox", { name: "Word" }),
    search: async (word: string) => {
      await dialog.getByRole("textbox", { name: "Word" }).fill(word);
      await dialog.getByRole("button", { name: "Look up" }).click();
    },
  };
}

async function openStory(page: Page) {
  const id = await seedStory("alice", {
    title: "Words",
    content: "Ala ma kota.",
  });
  await page.goto(`/chapters/${id}`);
}

test("an inflected form shows the synonyms of its lemma by sense, with labels and sources", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openSynonyms(page);
  await search("kota");

  const kot = dialog
    .getByRole("region", { name: "Synonyms of “kota”" })
    .getByRole("region", { name: "Shown for: kot", exact: true });
  await expect(kot).toBeVisible();

  const wiktionary = kot.getByRole("region", { name: "Wikisłownik" });
  await expect(wiktionary.getByText("noun")).toBeVisible();
  await expect(wiktionary.getByText("1.1zwierzę domowe")).toBeVisible();
  // Each word with its labels and every source that gives it (criteria 2, 3).
  await expect(wiktionary.locator("ul > li")).toHaveText([
    "dachowiecWSWikisłownikDSDobry słownik",
    "sierściuchscornfulWSWikisłownikDSDobry słownik",
    "kociamberdialect (Poznań)WSWikisłownik",
    "farfocelWSWikisłownik",
  ]);
  const entryLink = wiktionary.getByRole("link", {
    name: /Entry in Wikisłownik/,
  });
  await expect(entryLink).toHaveAttribute(
    "href",
    "https://pl.wiktionary.org/wiki/kot",
  );
  await expect(entryLink.locator("xpath=..")).toHaveText(
    "Entry in Wikisłownik(opens in a new tab), CC BY-SA 4.0",
  );

  // The duplicate stays in the thesaurus section too, with that source's own label.
  const thesaurus = kot.getByRole("region", { name: "Dobry słownik" });
  await expect(thesaurus.locator("ul > li")).toHaveText([
    "dachowiecWSWikisłownikDSDobry słownik",
    "sierściuchcolloquialWSWikisłownikDSDobry słownik",
    "mruczekendearingDSDobry słownik",
  ]);

  // Criterion 5: sources, licences and the required notices.
  const sources = dialog.getByRole("region", { name: "Sources" });
  await expect(sources.getByRole("listitem")).toHaveText([
    /^Wikisłownik, CC BY-SA 4\.0\. Changed: labels and regions/,
    /^Dobry słownik, LGPL 2\.1\. © 2014–2026 Dobry słownik\. © 2004–2014 Marcin Miłkowski\. Changed: registers/,
    "PoliMorf, BSD 2-Clause",
  ]);
  await expect(sources.getByRole("link", { name: "LGPL 2.1" })).toHaveAttribute(
    "href",
    "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html",
  );
});

test("a word only the thesaurus has shows just that section and source", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openSynonyms(page);
  await search("psa");
  const pies = dialog.getByRole("region", {
    name: "Shown for: pies",
    exact: true,
  });
  await expect(pies.getByRole("region", { name: "Wikisłownik" })).toHaveCount(
    0,
  );
  await expect(
    pies.getByRole("region", { name: "Dobry słownik" }).locator("ul > li"),
  ).toHaveText(["kundelvery colloquialDSDobry słownik"]);
  await expect(
    dialog.getByRole("region", { name: "Sources" }).getByRole("listitem"),
  ).toHaveText([/^Dobry słownik, LGPL 2\.1/, "PoliMorf, BSD 2-Clause"]);
});

test("no result gives a message", async ({ page }) => {
  await openStory(page);
  const { dialog, search } = await openSynonyms(page);
  await search("xyzq");
  await expect(dialog.getByRole("status")).toHaveText(
    "No synonyms found for “xyzq”.",
  );
  await expect(dialog.getByRole("region", { name: "Sources" })).toHaveCount(0);
});

test("the result stays after switching tabs, apart from the definitions", async ({
  page,
}) => {
  await openStory(page);
  const { dialog, search } = await openSynonyms(page);
  await search("kota");
  await expect(
    dialog.getByRole("region", { name: "Shown for: kot", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await sidebarTab(page, "Notes").click();

  // Each tile keeps its own lookup.
  await sidebarTab(page, "Tools").click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Definitions" })
    .click();
  const definitions = page.getByRole("dialog", { name: "Definitions" });
  await expect(definitions.getByRole("textbox", { name: "Word" })).toHaveValue(
    "",
  );
  await page.keyboard.press("Escape");

  const again = await openSynonyms(page);
  await expect(again.word).toHaveValue("kota");
  await expect(
    again.dialog.getByRole("region", { name: "Shown for: kot", exact: true }),
  ).toBeVisible();
});

test("an unavailable service gives a message", async ({ page }) => {
  await openStory(page);
  const { dialog, search } = await openSynonyms(page);
  await search("AWARIA");
  await expect(dialog.getByRole("alert")).toHaveText(
    "This tool is not available right now. Try again later.",
  );
});
