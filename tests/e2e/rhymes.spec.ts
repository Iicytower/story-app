import type { Page } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

// Answers come from fake-tools.mjs: "kota" has rhymes on every level, "wrota" is rare and "ta"
// a function word; AWARIA fails.

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

async function openRhymes(page: Page) {
  const id = await seedStory("alice", {
    title: "Verses",
    content: "Ala ma kota.",
  });
  await page.goto(`/stories/${id}`);
  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Tools" })
    .click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Rhymes" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Rhymes" });
  return {
    dialog,
    search: async (word: string) => {
      await dialog.getByRole("textbox", { name: "Word" }).fill(word);
      await dialog.getByRole("button", { name: "Look up" }).click();
    },
  };
}

test("rhymes show by level, with rare and function words behind Show more", async ({
  page,
}) => {
  const { dialog, search } = await openRhymes(page);
  await search("kota");
  const results = dialog.getByRole("region", { name: "Rhymes for “kota”" });

  // The word itself is left out (criterion 3).
  const exact = results.getByRole("region", { name: "Exact" });
  await expect(exact.getByRole("listitem")).toHaveText(["złota", "robota"]);
  await expect(
    results.getByRole("region", { name: "Near" }).getByRole("listitem"),
  ).toHaveText(["woda"]);
  const last = results.getByRole("region", { name: "Last syllable" });
  await expect(last.getByRole("listitem")).toHaveText(["lata"]);

  // Criterion 4: the function word "ta" waits behind Show more.
  await last.getByRole("button", { name: "Show more (1)" }).click();
  await expect(last.getByRole("listitem")).toHaveText(["lata", "ta"]);
  await last.getByRole("button", { name: "Show less" }).click();
  await expect(last.getByRole("listitem")).toHaveText(["lata"]);

  await exact.getByRole("button", { name: "Show more (1)" }).click();
  await expect(exact.getByRole("listitem")).toHaveText([
    "złota",
    "robota",
    "wrota",
  ]);

  // Criterion 7: the sources with their licences and notices.
  const sources = dialog.getByRole("region", { name: "Sources" });
  await expect(sources.getByRole("listitem")).toHaveText([
    /^PoliMorf, BSD 2-Clause\. Used: each form gets a rhyme key/,
    /^wordfreq, CC BY-SA 4\.0\. © 2022 Robyn Speer\. Used: frequencies rank the rhymes\. Data from Wikipedia, OpenSubtitles 2018 \(opensubtitles\.org\).*CC BY-SA 4\.0\.$/,
  ]);
  await expect(sources.getByRole("link", { name: "wordfreq" })).toHaveAttribute(
    "href",
    "https://github.com/rspeer/wordfreq",
  );
});

test("a new lookup starts with Show more collapsed", async ({ page }) => {
  const { dialog, search } = await openRhymes(page);
  await search("kota");
  const last = dialog.getByRole("region", { name: "Last syllable" });
  await last.getByRole("button", { name: "Show more (1)" }).click();
  await search("xyzq");
  await search("kota");
  await expect(last.getByRole("listitem")).toHaveText(["lata"]);
});

test("no result gives a message", async ({ page }) => {
  const { dialog, search } = await openRhymes(page);
  await search("xyzq");
  await expect(dialog.getByRole("status")).toHaveText(
    "No rhymes found for “xyzq”.",
  );
  await expect(dialog.getByRole("region", { name: "Sources" })).toHaveCount(0);
});

test("an unavailable service gives a message", async ({ page }) => {
  const { dialog, search } = await openRhymes(page);
  await search("AWARIA");
  await expect(dialog.getByRole("alert")).toHaveText(
    "This tool is not available right now. Try again later.",
  );
});
