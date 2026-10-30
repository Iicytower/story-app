import type { Locator } from "@playwright/test";
import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 1280, height: 800 },
});

const LONG = Array.from({ length: 100 }, (_, i) => `Line ${i}`).join("\n\n");
const SHORT = "Line 0\n\nLine 1";

type Mode = "Preview" | "Source";

const scrollerOf = (mode: Mode, field: Locator) =>
  field.locator(mode === "Preview" ? "xpath=.." : "xpath=../..");

// Where the first and last line sit relative to the top and bottom edge of the view.
function edges(mode: Mode, field: Locator) {
  return field.evaluate((element, mode) => {
    const preview = mode === "Preview";
    const scroller = preview
      ? element.parentElement!
      : element.parentElement!.parentElement!;
    const view = scroller.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const line = preview ? element.firstElementChild! : element;
    const lineHeight = parseFloat(getComputedStyle(line).lineHeight);
    const first = preview
      ? element.firstElementChild!.getBoundingClientRect().top
      : box.top;
    const last = preview
      ? element.lastElementChild!.getBoundingClientRect().bottom - lineHeight
      : box.bottom - lineHeight;
    return {
      lineHeight,
      firstFromBottom: view.bottom - first,
      lastFromTop: last - view.top,
    };
  }, mode);
}

async function scrollToEnd(mode: Mode, field: Locator, end: "top" | "bottom") {
  await scrollerOf(mode, field).evaluate((element, end) => {
    element.scrollTop = end === "top" ? 0 : element.scrollHeight;
  }, end);
}

async function expectLimits(mode: Mode, field: Locator) {
  await scrollToEnd(mode, field, "bottom");
  await expect
    .poll(async () => Math.abs((await edges(mode, field)).lastFromTop))
    .toBeLessThan(2);
  await scrollToEnd(mode, field, "top");
  await expect
    .poll(async () => {
      const { firstFromBottom, lineHeight } = await edges(mode, field);
      return Math.abs(firstFromBottom - lineHeight);
    })
    .toBeLessThan(2);
}

async function seed(content: string) {
  const id = await seedStory("alice", {
    title: "Edges",
    content,
    notes: content,
  });
  return id;
}

for (const mode of ["Preview", "Source"] as const)
  test.describe(mode, () => {
    for (const [name, text] of [
      ["long", LONG],
      ["short", SHORT],
    ])
      for (const label of ["Content", "Notes"])
        test(`${label}: ${name} text stops at its first and last line`, async ({
          page,
        }) => {
          const id = await seed(text);
          await page.goto(`/stories/${id}`);
          const editor = markdownEditor(page, label);
          await expect(
            editor.field.getByText("Line 0", { exact: true }),
          ).toBeVisible();
          if (mode === "Source") await editor.button("Source").click();
          await expectLimits(mode, editor.group.getByRole("textbox"));
        });

    test("the limits follow window and panel size", async ({ page }) => {
      const id = await seed(LONG);
      await page.goto(`/stories/${id}`);
      const editor = markdownEditor(page, "Content");
      await expect(editor.field).toBeVisible();
      if (mode === "Source") await editor.button("Source").click();
      const field = editor.group.getByRole("textbox");

      await page.setViewportSize({ width: 1100, height: 500 });
      await expectLimits(mode, field);
      // Hide remounts the editor, which always opens in Preview.
      await page.getByRole("button", { name: "Hide notes" }).click();
      await expect(editor.button("Preview")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      if (mode === "Source") await editor.button("Source").click();
      await page.setViewportSize({ width: 1280, height: 800 });
      await expectLimits(mode, field);
    });
  });

test("opens with the first line at the bottom of the view", async ({
  page,
}) => {
  const id = await seed(LONG);
  await page.goto(`/stories/${id}`);
  const { field } = markdownEditor(page, "Content");
  await expect(field.getByText("Line 0", { exact: true })).toBeVisible();

  await expect
    .poll(() => scrollerOf("Preview", field).evaluate((e) => e.scrollTop))
    .toBe(0);
  const { firstFromBottom, lineHeight } = await edges("Preview", field);
  expect(Math.abs(firstFromBottom - lineHeight)).toBeLessThan(2);
});

test("the last line stays in view across switching modes", async ({ page }) => {
  const id = await seed(LONG);
  await page.goto(`/stories/${id}`);
  const editor = markdownEditor(page, "Content");
  await expect(editor.field).toBeVisible();
  await scrollToEnd("Preview", editor.field, "bottom");

  await editor.button("Source").click();
  const { lastFromTop, lineHeight } = await edges(
    "Source",
    editor.group.getByRole("textbox"),
  );
  expect(lastFromTop).toBeLessThan(lineHeight * 2);
  expect(lastFromTop).toBeGreaterThan(-lineHeight);
});

test("Source: clicking the empty space focuses the text, typing keeps the caret in view", async ({
  page,
}) => {
  const id = await seed(LONG);
  await page.goto(`/stories/${id}`);
  const editor = markdownEditor(page, "Content");
  await expect(editor.field).toBeVisible();
  await editor.button("Source").click();
  const field = editor.group.getByRole("textbox");

  const scroller = scrollerOf("Source", field);
  await scroller.click({ position: { x: 300, y: 20 } });
  await expect(field).toBeFocused();

  await page.keyboard.press("Control+End");
  await page.keyboard.type("x");
  const { lastFromTop } = await edges("Source", field);
  const box = (await scroller.boundingBox())!;
  expect(lastFromTop).toBeGreaterThanOrEqual(-1);
  expect(lastFromTop).toBeLessThan(box.height);
});
