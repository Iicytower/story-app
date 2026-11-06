import type { Page } from "@playwright/test";
import { findSettings, findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, openSettings, test } from "./helpers";

// Answers come from fake-tools.mjs: Napewno, NAPEWNO, Wogóle and tą have suggestions, dobry
// has none.
// Each test runs one check; PROOFREAD_LIMIT allows 10 per user in 10 minutes.

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

async function openProofread(page: Page) {
  await page
    .getByRole("tablist", { name: "Side panel" })
    .getByRole("tab", { name: "Tools" })
    .click();
  await page
    .getByRole("list", { name: "Tools" })
    .getByRole("button", { name: "Proofread" })
    .click();
  return proofreadDialog(page);
}

function proofreadDialog(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Proofread" });
  const text = dialog.getByRole("textbox", { name: "Checked text" });
  return {
    dialog,
    text,
    panel: dialog.getByRole("region", { name: "Change" }),
    proposal: (original: string) =>
      text.locator("[data-proposal]", { hasText: original }),
    // The ✓/✗ next to the n-th proposal in the text.
    inline: (name: "Apply change" | "Reject change", nth: number) =>
      text.getByRole("button", { name }).nth(nth),
  };
}

const MD = "Napewno **Wogóle** i tą książkę.\n\n– Dobry, dobry.";

test("marks every issue, takes decisions and Accept saves one Undo step", async ({
  page,
}) => {
  // No timers: the chapter must be saved by Accept itself, not by autosave.
  await page.clock.install();
  const id = await seedStory("alice", { title: "Proof", content: MD });
  await page.goto(`/stories/${id}`);
  const { dialog, text, panel, proposal, inline } = await openProofread(page);

  await expect(text.locator("[data-proposal]")).toHaveCount(4);
  await expect(proposal("Napewno")).toHaveClass(/bg-diff-removed/);
  await expect(proposal("dobry")).toHaveClass(/bg-proofread-note/);
  await expect(text.locator("ins").first()).toHaveText("Na pewno");
  await expect(panel.getByText("1 of 4")).toBeVisible();
  await expect(panel.getByText("Spelling")).toBeVisible();

  // Another suggestion from the list, then ✓ in the text.
  await panel
    .getByRole("group", { name: "Suggestions" })
    .getByRole("button", { name: "Napewnie" })
    .click();
  await expect(text.locator("ins").first()).toHaveText("Napewnie");
  await inline("Apply change", 0).click();
  await expect(text.locator("p").first()).toHaveText(/^Napewnie Wogóle/);

  // ✗ in the text on Wogóle, ✓ in the panel on tą.
  await expect(panel.getByText("1 of 3")).toBeVisible();
  await inline("Reject change", 0).click();
  await expect(proposal("Wogóle")).toHaveCount(0);
  await expect(panel.getByText("Grammar")).toBeVisible();
  await panel.getByRole("button", { name: "Apply change" }).click();
  await expect(text.locator("p").first()).toContainText("i tę książkę");

  // An issue without suggestions: description and reject only.
  await expect(panel.getByText("Powtórzony wyraz w zdaniu")).toBeVisible();
  await expect(panel.getByText(/No suggestion/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Apply change" })).toHaveCount(
    0,
  );

  // Own text typed in the dialog.
  await text.locator("p").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Koniec");

  await dialog.getByRole("button", { name: "Accept" }).click();
  await expect(dialog).toBeHidden();
  const accepted =
    "Napewnie **Wogóle** i tę książkę. Koniec\n\n– Dobry, dobry.";
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe(accepted);

  const content = markdownEditor(page, "Content");
  await content.button("Undo").click();
  expect(await content.source()).toBe(MD);
  await content.button("Redo").click();
  expect(await content.source()).toBe(accepted);
});

test("closing the dialog without Accept leaves the chapter as it was", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Proof", content: MD });
  await page.goto(`/stories/${id}`);
  const { dialog, inline } = await openProofread(page);
  await inline("Apply change", 0).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  const content = markdownEditor(page, "Content");
  expect(await content.source()).toBe(MD);
  expect((await findStoryById(id))?.content).toBe(MD);
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

  const { dialog } = await openProofread(page);
  await expect(dialog.getByRole("status")).toHaveText(/Checking the chapter/);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe("POWOLI Napewno. Dalej");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await content.field.click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  // The fake answers after 4 s; the dialog must not come back with it.
  await page.waitForTimeout(4500);
  await expect(dialog).toBeHidden();
  expect(await content.source()).toBe("POWOLI Napewno. Dalej!");
});

test("an unavailable tools server gives a message and changes nothing", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Down",
    content: "AWARIA Napewno.",
  });
  await page.goto(`/stories/${id}`);
  const { dialog } = await openProofread(page);
  await expect(dialog.getByRole("alert")).toHaveText(
    "This tool is not available right now. Try again later.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
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
  const { dialog } = await openProofread(page);
  await expect(dialog.getByRole("status")).toHaveText("No issues found.");
});

test("Accept in Source mode is one native Undo step and keeps the markup as written", async ({
  page,
}) => {
  // Underscores and a list marker the editor would write differently.
  // A chapter ending in a list would be rewritten by the editor on opening (trailing paragraph).
  const MD = "* Napewno _tak_\n* i tą książkę\n\nKoniec.";
  const id = await seedStory("alice", { title: "Source", content: MD });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.button("Source").click();
  const { dialog, inline } = await openProofread(page);
  await inline("Apply change", 0).click();
  await dialog.getByRole("button", { name: "Accept" }).click();

  const textarea = content.group.getByRole("textbox", { name: "Content" });
  const accepted = MD.replace("Napewno", "Na pewno");
  await expect(textarea).toHaveValue(accepted);
  await expect
    .poll(async () => (await findStoryById(id))?.content)
    .toBe(accepted);
  await textarea.focus();
  await page.keyboard.press("Control+z");
  await expect(textarea).toHaveValue(MD);
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Accept from the tools view shows the changed story", async ({
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
    const { dialog, panel } = proofreadDialog(page);
    await panel.getByRole("button", { name: "Apply change" }).click();
    await dialog.getByRole("button", { name: "Accept" }).click();

    await expect(
      page.getByRole("tab", { name: "Story", selected: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Content", exact: true }),
    ).toContainText("Na pewno");
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
  const first = await openProofread(page);
  const { panel, proposal } = first;
  let { dialog, text } = first;
  await expect(text.locator("[data-proposal]")).toHaveCount(4);

  // Grammar (tą) gets no dictionary button.
  await proposal("tą").click();
  await expect(panel.getByText("Grammar")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Add to dictionary" }),
  ).toHaveCount(0);

  // Both forms of the word go at once; the other spelling issue stays.
  await proposal("Napewno").first().click();
  await panel.getByRole("button", { name: "Add to dictionary" }).click();
  await expect(text.locator("[data-proposal]")).toHaveCount(2);
  await expect(proposal("Napewno")).toHaveCount(0);
  await expect(proposal("NAPEWNO")).toHaveCount(0);
  await expect(panel.getByText("Grammar")).toBeVisible();
  expect((await findSettings("alice"))?.proofreading).toEqual({
    dictionary: ["Napewno"],
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // A later check does not show it.
  ({ dialog, text } = await openProofread(page));
  await expect(text.locator("[data-proposal]")).toHaveCount(2);
  await expect(text.locator("[data-proposal]", { hasText: "Napewno" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

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

  ({ text } = await openProofread(page));
  await expect(text.locator("[data-proposal]")).toHaveCount(4);
});
