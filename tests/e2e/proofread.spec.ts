import type { Page } from "@playwright/test";
import {
  findSettings,
  findStoryById,
  proofreadAttempts,
  seedStory,
  updateStoryById,
} from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, openSettings, test } from "./helpers";

// Answers come from fake-tools.mjs: Napewno, NAPEWNO, Wogóle and tą have suggestions, dobry
// has none; AWARIA fails and POWOLI answers after 4 s.
// PROOFREAD_LIMIT allows 10 checks per user in 10 minutes.

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

// The proofreading in the chapter's editor (task 55).
function proofreading(page: Page) {
  const text = markdownEditor(page, "Content").field;
  const bubble = page.getByRole("dialog", { name: "Issue" });
  return {
    text,
    bar: page.getByRole("toolbar", { name: "Proofreading" }),
    bubble,
    proposal: (original: string) =>
      text.locator("[data-proposal]", { hasText: original }),
    // The ✓/✗ next to the n-th proposal in the text.
    inline: (name: "Apply change" | "Reject change", nth: number) =>
      text.getByRole("button", { name }).nth(nth),
  };
}

async function openTile(page: Page) {
  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Tools" })
    .click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Proofread" })
    .click();
  return page.getByRole("dialog", { name: "Proofread" });
}

// Opens the tile and runs the check; the dialog stays open on a message.
async function check(page: Page) {
  const dialog = await openTile(page);
  await dialog.getByRole("button", { name: "Check" }).click();
  return { dialog, ...proofreading(page) };
}

const MD = "Napewno **Wogóle** i tą książkę.\n\n– Dobry, dobry.";

test("asks first and sends nothing to LanguageTool until Check", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Ask", content: MD });
  await page.goto(`/stories/${id}`);
  const dialog = await openTile(page);
  await expect(
    dialog.getByText("Do you want to use the proofreading tool?"),
  ).toBeVisible();
  await expect(
    dialog.getByText(/^LanguageTool checks the spelling/),
  ).toHaveClass(/text-xs/);
  const button = dialog.getByRole("button", { name: "Check" });
  await expect(button).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect(await proofreadAttempts()).toBe(0);

  const { bar, bubble } = await check(page);
  await expect(bar).toBeVisible();
  expect(await proofreadAttempts()).toBe(1);
  // The dialog closes and the first issue's details take the focus.
  await expect(page.getByRole("dialog", { name: "Proofread" })).toBeHidden();
  await expect(bubble.getByText("Spelling")).toBeVisible();
  await expect(
    bubble.getByRole("button", { name: "Close details" }),
  ).toBeFocused();
});

test("marks the issues in the chapter's editor, where decisions and typing change the text", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Proof", content: MD });
  await page.goto(`/stories/${id}`);
  const { text, bar, bubble, proposal, inline } = await check(page);

  await expect(text.locator("[data-proposal]")).toHaveCount(4);
  await expect(proposal("Napewno")).toHaveClass(/bg-diff-removed/);
  await expect(proposal("dobry")).toHaveClass(/bg-proofread-note/);
  await expect(text.locator("ins").first()).toHaveText("Na pewno");
  await expect(bar.getByText("1 of 4")).toBeVisible();

  // Another suggestion from the list, then ✓ in the bubble.
  await bubble
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "Napewnie" })
    .click();
  await expect(text.locator("ins").first()).toHaveText("Napewnie");
  await bubble.getByRole("button", { name: "Apply change" }).click();
  await expect(text.locator("p").first()).toHaveText(/^Napewnie Wogóle/);
  await expect(bar.getByText("1 of 3")).toBeVisible();

  // ✗ in the text, then a click on an issue opens its details.
  await inline("Reject change", 0).click();
  await expect(proposal("Wogóle")).toHaveCount(0);
  await proposal("tą").click();
  await expect(bubble.getByText("Grammar")).toBeVisible();
  await bubble.getByRole("button", { name: "Apply change" }).click();
  await expect(text.locator("p").first()).toContainText("i tę książkę");

  // An issue without suggestions: description and reject only.
  await expect(bubble.getByText("Powtórzony wyraz w zdaniu")).toBeVisible();
  await expect(bubble.getByText(/No suggestion/)).toBeVisible();
  await expect(
    bubble.getByRole("button", { name: "Apply change" }),
  ).toHaveCount(0);

  // Own text, typed in the chapter itself.
  await text.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Koniec");
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("Napewnie **Wogóle** i tę książkę. Koniec\n\n– Dobry, dobry.");
  expect(
    (await findStoryById(id))?.proofreading?.proposals.map(
      ({ original }) => original,
    ),
  ).toEqual(["dobry"]);

  // The last decision ends the proofreading: the bar goes and the state is cleared.
  await proposal("dobry").click();
  await bubble.getByRole("button", { name: "Reject change" }).click();
  await expect(bar).toBeHidden();
  await expect(text.locator("[data-proposal]")).toHaveCount(0);
  await expect(text).toBeFocused();
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await findStoryById(id))?.proofreading)
    .toBeUndefined();
});

test("comes back after a reload with the same issues and the same current one", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Again", content: MD });
  await page.goto(`/stories/${id}`);
  const { text, bar, bubble } = await check(page);
  await bubble.getByRole("button", { name: "Reject change" }).click();
  await bubble
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "W ogóle" })
    .click();
  await bar.getByRole("button", { name: "Next change" }).click();
  await expect(bar.getByText("2 of 3")).toBeVisible();
  await expect(bubble.getByText("Grammar")).toBeVisible();
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await findStoryById(id))?.proofreading?.selected)
    .toBe(1);

  await page.reload();
  await expect(bar.getByText("2 of 3")).toBeVisible();
  await expect(text.locator("[data-proposal]")).toHaveText([
    "Wogóle",
    "tą",
    "dobry",
  ]);
  await expect(text.locator("[data-proposal-current]")).toHaveText("tą");
  // Opening the chapter does not save it.
  const before = (await findStoryById(id))?.updatedAt;
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(500);
  expect((await findStoryById(id))?.updatedAt).toEqual(before);
});

test("a saved proofreading that no longer fits the text is dropped on opening", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Stale", content: MD });
  await updateStoryById(id, {
    proofreading: {
      proposals: [
        {
          at: 3,
          original: "Zniknęło",
          kind: "spelling",
          message: "",
          replacements: [],
          ruleId: "X",
          choice: 0,
        },
      ],
      selected: 0,
    },
  });
  await page.goto(`/stories/${id}`);
  const { bar, text } = proofreading(page);
  await expect(text).toBeVisible();
  await expect(bar).toBeHidden();
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await findStoryById(id))?.proofreading)
    .toBeUndefined();
  const dialog = await openTile(page);
  await expect(
    dialog.getByText("Do you want to use the proofreading tool?"),
  ).toBeVisible();
});

test("other tools work during proofreading, and Source is blocked until it ends", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Tools", content: MD });
  await page.goto(`/stories/${id}`);
  const { bar, text, bubble } = await check(page);
  await expect(bubble).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bubble).toBeHidden();
  await expect(text).toBeFocused();

  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Definitions" })
    .click();
  const definitions = page.getByRole("dialog", { name: "Definitions" });
  await expect(definitions).toBeVisible();
  await definitions.getByRole("button", { name: "Close" }).first().click();
  await expect(bar).toBeVisible();

  const content = markdownEditor(page, "Content");
  const source = content.button("Source");
  await expect(source).toHaveAttribute("aria-disabled", "true");
  await source.click({ force: true });
  await expect(content.button("Preview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Finish proofreading: the issues go, the text stays.
  await bar.getByRole("button", { name: "Finish proofreading" }).click();
  await expect(bar).toBeHidden();
  await expect(text.locator("[data-proposal]")).toHaveCount(0);
  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await findStoryById(id))?.proofreading)
    .toBeUndefined();
  expect((await findStoryById(id))?.content).toBe(MD);
  await source.click();
  await expect(content.group.getByRole("textbox")).toHaveValue(MD);
});

test("a check during proofreading asks and replaces the issues left", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Twice", content: MD });
  await page.goto(`/stories/${id}`);
  const { text, bubble } = await check(page);
  await bubble.getByRole("button", { name: "Reject change" }).click();
  await expect(text.locator("[data-proposal]")).toHaveCount(3);

  const dialog = await openTile(page);
  await expect(
    dialog.getByText(
      "This chapter is being proofread. Do you want to check it again?",
    ),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Check" }).click();
  await expect(dialog).toBeHidden();
  await expect(text.locator("[data-proposal]")).toHaveCount(4);
});

test("saves unsaved edits before the check and drops an answer that comes after closing", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Slow",
    content: "POWOLI Napewno.",
  });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Dalej");

  const { dialog, bar } = await check(page);
  await expect(dialog.getByRole("status")).toHaveText(/Checking the chapter/);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("POWOLI Napewno. Dalej");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  // The fake answers after 4 s; nothing may come of it.
  await page.waitForTimeout(4500);
  await expect(dialog).toBeHidden();
  await expect(bar).toBeHidden();
  expect(await content.source()).toBe("POWOLI Napewno. Dalej!");
});

test("an unavailable tools server gives a message, can be tried again and changes nothing", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Down",
    content: "AWARIA Napewno.",
  });
  await page.goto(`/stories/${id}`);
  const { dialog, bar } = await check(page);
  const message = "This tool is not available right now. Try again later.";
  await expect(dialog.getByRole("alert")).toHaveText(message);
  await dialog.getByRole("button", { name: "Check again" }).click();
  await expect.poll(proofreadAttempts).toBe(2);
  await expect(dialog.getByRole("alert")).toHaveText(message);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(bar).toBeHidden();
  const content = markdownEditor(page, "Content");
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  expect(await content.source()).toBe("AWARIA Napewno.!");
});

test("a chapter without issues gives a message", async ({ page }) => {
  const id = await seedStory("alice", {
    title: "Clean",
    content: "Ala ma kota.",
  });
  await page.goto(`/stories/${id}`);
  const { dialog, bar } = await check(page);
  await expect(dialog.getByRole("status")).toHaveText("No issues found.");
  await expect(bar).toBeHidden();
  await dialog.getByRole("button", { name: "Close" }).last().click();
  await expect(dialog).toBeHidden();
});

test("a check from Source goes to Preview", async ({ page }) => {
  const id = await seedStory("alice", { title: "Source", content: MD });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.button("Source").click();
  const { text } = await check(page);
  await expect(text.locator("[data-proposal]")).toHaveCount(4);
  await expect(content.button("Preview")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a check from the tools view shows the story with the issues", async ({
    page,
  }) => {
    const id = await seedStory("alice", { title: "Mobile", content: MD });
    await page.goto(`/stories/${id}`);
    await page
      .getByRole("tablist", { name: "View" })
      .getByRole("tab", { name: "Tools" })
      .click();
    await page
      .getByRole("list", { name: "Tools" })
      .getByRole("button", { name: "Proofread" })
      .click();
    await page
      .getByRole("dialog", { name: "Proofread" })
      .getByRole("button", { name: "Check" })
      .click();
    const { bubble, text } = proofreading(page);

    await expect(
      page.getByRole("tab", { name: "Story", selected: true }),
    ).toBeVisible();
    await bubble.getByRole("button", { name: "Apply change" }).click();
    await expect(text).toContainText("Na pewno");
    await page.keyboard.press("Control+s");
    await expect
      .poll(async () => (await findStoryById(id))?.content)
      .toBe(MD.replace("Napewno", "Na pewno"));
  });
});

test("a word added to the dictionary stays out of later checks until removed in Settings", async ({
  page,
}) => {
  const content = "Napewno tą drogą, NAPEWNO.\n\nWogóle nie.";
  const id = await seedStory("alice", { title: "Dict", content });
  await page.goto(`/stories/${id}`);
  const { text, bubble, proposal } = await check(page);
  await expect(text.locator("[data-proposal]")).toHaveCount(4);

  // Grammar (tą) gets no dictionary button.
  await proposal("tą").click();
  await expect(bubble.getByText("Grammar")).toBeVisible();
  await expect(
    bubble.getByRole("button", { name: "Add to dictionary" }),
  ).toHaveCount(0);

  // Both forms of the word go at once; the other spelling issue stays.
  await proposal("Napewno").first().click();
  await bubble.getByRole("button", { name: "Add to dictionary" }).click();
  await expect(text.locator("[data-proposal]")).toHaveCount(2);
  await expect(proposal("Napewno")).toHaveCount(0);
  await expect(proposal("NAPEWNO")).toHaveCount(0);
  expect((await findSettings("alice"))?.proofreading).toEqual({
    dictionary: ["Napewno"],
  });

  // A later check does not show it.
  await check(page);
  await expect(text.locator("[data-proposal]")).toHaveCount(2);
  await expect(proposal("Napewno")).toHaveCount(0);
  await page.keyboard.press("Escape");

  const settings = await openSettings(page);
  await expect(settings.getByText("1 word")).toBeVisible();
  await settings.getByRole("button", { name: "Remove “Napewno”" }).click();
  await expect(settings.getByText("No words yet.")).toBeVisible();
  await expect(
    settings.getByRole("heading", { name: "Proofreading dictionary" }),
  ).toBeFocused();
  expect((await findSettings("alice"))?.proofreading).toEqual({
    dictionary: [],
  });
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();

  await check(page);
  await expect(text.locator("[data-proposal]")).toHaveCount(4);
});
