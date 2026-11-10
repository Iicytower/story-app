import { findStoryById, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

// The real browser encoding through React Flight, which failed with a 500 from ~1 MB (F8).
const MAX = 500_000;
// Paragraphs, like a real chapter: one paragraph of this length is far slower to lay out.
const PARAGRAPH = "Zażółć gęślą jaźń. ".repeat(50).trim();
const text = (length: number) =>
  Array.from({ length: Math.ceil(length / PARAGRAPH.length) }, () => PARAGRAPH)
    .join("\n\n")
    .slice(0, length);


test("saves a chapter of exactly 500,000 characters", async ({ page }) => {
  const id = await seedStory("alice", { title: "Long" });
  await page.goto(`/stories/${id}`);
  await markdownEditor(page, "Content").setSource(text(MAX));
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText("Saved");
  expect((await findStoryById(id))?.content).toHaveLength(MAX);
});

test("a pasted text over the limit gives a message and stays in the editor", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Too long", content: "Before" });
  await page.goto(`/stories/${id}`);
  const content = markdownEditor(page, "Content");
  await content.setSource(text(MAX + 1));
  const message =
    "A chapter can have at most 500,000 characters. Shorten it or split it into chapters; the text stays in the editor until then.";
  // Shown at once under the text, before any save.
  await expect(page.getByText(message)).toHaveCount(1);
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText(message);
  expect((await findStoryById(id))?.content).toBe("Before");
  expect(await content.source()).toHaveLength(MAX + 1);
});
