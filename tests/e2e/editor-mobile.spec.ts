import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 390, height: 844 },
});

test("switches between story, notes and chapters on a narrow screen", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Mobile",
    folder: "Book",
    content: "# Heading",
    notes: "Remember the dragon",
    createdAt: new Date("2026-01-01"),
  });
  await seedStory("alice", {
    title: "Other chapter",
    folder: "Book",
    createdAt: new Date("2026-01-02"),
  });

  await page.goto(`/stories/${id}`);
  const content = page.getByRole("textbox", { name: "Content", exact: true });
  const preview = page.getByRole("region", { name: "Preview" });
  const notes = page.getByRole("textbox", { name: "Notes", exact: true });
  const folderNotes = page.getByRole("textbox", { name: "Folder notes" });
  const chapters = page.getByRole("list", { name: "Chapters" });
  const tab = (name: string) =>
    page.getByRole("tablist", { name: "View" }).getByRole("tab", { name });

  await expect(tab("Story")).toHaveAttribute("aria-selected", "true");
  await expect(content).toBeVisible();
  await expect(preview).toBeVisible();
  await expect(notes).toBeHidden();
  await expect(chapters).toBeHidden();
  await expect(page.getByRole("button", { name: "Hide notes" })).toBeHidden();
  await expect(page.getByRole("separator")).toHaveCount(0);

  await content.fill("# Changed");
  await expect(preview.getByRole("heading", { name: "Changed" })).toBeVisible();

  await tab("Notes").click();
  await expect(tab("Notes")).toHaveAttribute("aria-selected", "true");
  await expect(folderNotes).toBeVisible();
  await expect(notes).toHaveValue("Remember the dragon");
  const folderBox = await folderNotes.boundingBox();
  const notesBox = await notes.boundingBox();
  expect(folderBox!.y).toBeLessThan(notesBox!.y);
  await expect(content).toBeHidden();

  await tab("Chapters").click();
  await expect(chapters.getByRole("link")).toHaveText([
    "Other chapter",
    "Mobile",
  ]);
  await expect(notes).toBeHidden();

  await tab("Story").click();
  await expect(content).toHaveValue("# Changed");
});

test("shows the story and the side panel side by side on a wide screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await seedStory("alice", { title: "Desktop" });

  await page.goto(`/stories/${id}`);
  await expect(page.getByRole("tablist", { name: "View" })).toBeHidden();
  await expect(
    page.getByRole("textbox", { name: "Content", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Preview" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Notes", exact: true }),
  ).toBeVisible();
});

test("keeps toolbar buttons accessible by name on a narrow screen", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "Toolbar" });

  await page.goto(`/stories/${id}`);
  await expect(page.getByRole("button", { name: "Export .md" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
