import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  viewport: { width: 390, height: 844 },
});

test("switches between editor, preview and notes on a narrow screen", async ({
  page,
}) => {
  const id = await seedStory("alice", {
    title: "Mobile",
    content: "# Heading",
    notes: "Remember the dragon",
  });

  await page.goto(`/stories/${id}`);
  const content = page.getByRole("textbox", { name: "Content", exact: true });
  const preview = page.getByRole("region", { name: "Preview" });
  const notes = page.getByRole("textbox", { name: "Notes", exact: true });
  const tab = (name: string) => page.getByRole("tab", { name });

  await expect(tab("Editor")).toHaveAttribute("aria-selected", "true");
  await expect(content).toBeVisible();
  await expect(preview).toBeHidden();
  await expect(notes).toBeHidden();
  await expect(page.getByRole("button", { name: "Hide notes" })).toBeHidden();

  await content.fill("# Changed");
  await tab("Preview").click();
  await expect(tab("Preview")).toHaveAttribute("aria-selected", "true");
  await expect(preview.getByRole("heading", { name: "Changed" })).toBeVisible();
  await expect(content).toBeHidden();
  await expect(notes).toBeHidden();

  await tab("Notes").click();
  await expect(notes).toBeVisible();
  await expect(notes).toHaveValue("Remember the dragon");
  await expect(content).toBeHidden();
  await expect(preview).toBeHidden();

  await tab("Editor").click();
  await expect(content).toHaveValue("# Changed");
});

test("shows all panels side by side on a wide screen", async ({ page }) => {
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
