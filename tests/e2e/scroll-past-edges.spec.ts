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
      // Empty space above the first line, in lines.
      gapTop: (first - view.top) / lineHeight,
      // Empty space below the last line, in multiples of the view minus one line.
      gapBottom: (view.bottom - last - lineHeight) / (view.height - lineHeight),
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
  // A short text with its gaps may fit in a tall view, which then has nothing to scroll.
  const scrolls = await scrollerOf(mode, field).evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  );
  await scrollToEnd(mode, field, "bottom");
  if (scrolls)
    await expect
      .poll(async () => Math.abs((await edges(mode, field)).gapBottom - 3 / 4))
      .toBeLessThan(0.01);
  await scrollToEnd(mode, field, "top");
  await expect
    .poll(async () => Math.abs((await edges(mode, field)).gapTop - 2))
    .toBeLessThan(0.05);
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
          await page.goto(`/chapters/${id}`);
          const editor = markdownEditor(page, label);
          await expect(
            editor.field.getByText("Line 0", { exact: true }),
          ).toBeVisible();
          if (mode === "Source") await editor.mode("Markdown");
          await expectLimits(mode, editor.group.getByRole("textbox"));
        });

    test("the limits follow window and panel size", async ({ page }) => {
      const id = await seed(LONG);
      await page.goto(`/chapters/${id}`);
      const editor = markdownEditor(page, "Content");
      await expect(editor.field).toBeVisible();
      if (mode === "Source") await editor.mode("Markdown");
      const field = editor.group.getByRole("textbox");

      await page.setViewportSize({ width: 1100, height: 500 });
      await expectLimits(mode, field);
      // Hide remounts the editor, which always opens in Preview.
      await page.getByRole("button", { name: "Hide notes" }).click();
      await expect(editor.button("Text")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      if (mode === "Source") await editor.mode("Markdown");
      await page.setViewportSize({ width: 1280, height: 800 });
      await expectLimits(mode, field);
    });
  });

for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 800 }],
  ["a narrow screen", { width: 375, height: 812 }],
] as const)
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    for (const label of ["Content", "Notes"])
      test(`${label} opens with the first line two lines below the top`, async ({
        page,
      }) => {
        const id = await seed(LONG);
        await page.goto(`/chapters/${id}`);
        if (label === "Notes" && name !== "desktop")
          await page
            .getByRole("tablist", { name: "View" })
            .getByRole("tab", { name: "Notes" })
            .click();
        const { field } = markdownEditor(page, label);
        await expect(field.getByText("Line 0", { exact: true })).toBeVisible();

        await expect
          .poll(() => scrollerOf("Preview", field).evaluate((e) => e.scrollTop))
          .toBe(0);
        const { gapTop } = await edges("Preview", field);
        expect(Math.abs(gapTop - 2)).toBeLessThan(0.05);
      });
  });

test("the last line stays in view across switching modes", async ({ page }) => {
  const id = await seed(LONG);
  await page.goto(`/chapters/${id}`);
  const editor = markdownEditor(page, "Content");
  await expect(editor.field).toBeVisible();
  await scrollToEnd("Preview", editor.field, "bottom");

  await editor.mode("Markdown");
  const { lastFromTop, lineHeight } = await edges(
    "Source",
    editor.group.getByRole("textbox"),
  );
  const view = (await scrollerOf(
    "Source",
    editor.group.getByRole("textbox"),
  ).boundingBox())!;
  expect(lastFromTop).toBeGreaterThan(-lineHeight);
  expect(lastFromTop).toBeLessThan(view.height - lineHeight);
});

test("Source: clicking the empty space focuses the text, typing keeps the caret in view", async ({
  page,
}) => {
  const id = await seed(LONG);
  await page.goto(`/chapters/${id}`);
  const editor = markdownEditor(page, "Content");
  await expect(editor.field).toBeVisible();
  await editor.mode("Markdown");
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
