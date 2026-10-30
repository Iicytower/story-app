import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { EXPORT_FORMATS } from "@/lib/export/formats";
import { findFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, markdownEditor, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

const pick = (page: Page, name: string, data: Buffer | string) =>
  page.getByLabel("File", { exact: true }).setInputFiles({
    name,
    mimeType: "application/octet-stream",
    buffer: Buffer.from(data),
  });

async function openImport(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Import…" }).click();
}

const submit = (page: Page) =>
  page.getByRole("button", { name: "Import", exact: true }).click();

for (const { id, extension } of EXPORT_FORMATS) {
  test(`imports an exported .${id} in the browser`, async ({ page }) => {
    const storyId = await seedStory("alice", {
      title: "Źródło",
      content: "Tekst do importu",
    });
    await page.goto(`/stories/${storyId}`);
    await page.getByRole("button", { name: "Export as…" }).click();
    await page.getByLabel("Format").selectOption(id);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const file = await readFile(await (await downloadPromise).path());

    await openImport(page, "/stories");
    await pick(page, `kopia.${extension}`, file);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Źródło",
    );
    await page.getByLabel("Folder", { exact: true }).fill("Importy");
    await submit(page);

    await expect(page).toHaveURL(/\/stories\/[0-9a-f]{24}$/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Źródło",
    );
    const source = await markdownEditor(page, "Content").source();
    expect(source).toContain("Tekst do importu");
    expect(await findFolder("Importy")).toBeTruthy();
  });
}

test("a file with chapters makes a new folder, or one chapter when not split", async ({
  page,
}) => {
  const markdown = "# Książka\n\n## Raz\n\nA\n\n## Dwa\n\nB\n";
  await openImport(page, "/stories");
  await pick(page, "a.md", markdown);
  const list = page.getByRole("list", { name: "Chapters to import" });
  await expect(list.getByRole("listitem")).toHaveText(["Raz", "Dwa"]);

  await page.getByLabel("Split into 2 chapters").uncheck();
  await expect(list).toBeHidden();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Książka",
  );
  await page.getByLabel("Split into 2 chapters").check();

  await expect(page.getByLabel("New folder")).toHaveValue("Książka");
  await submit(page);
  await expect(page).toHaveURL(/\/folders\/[0-9a-f]{24}$/);
  await expect(
    page.getByRole("heading", { name: "Książka", level: 1 }),
  ).toBeVisible();
  const chapters = page.getByRole("list", { name: "Chapters" });
  await expect(chapters.getByRole("listitem")).toHaveCount(2);
  await expect(chapters.getByRole("listitem").first()).toContainText("Raz");
});

test("a folder's page adds the chapters to that folder", async ({ page }) => {
  await seedStory("alice", { title: "Istniejący", folder: "Moje" });
  const folder = await findFolder("Moje");
  await openImport(page, `/folders/${folder?._id}`);
  await pick(page, "a.md", "# T\n\n## Istniejący\n\nA\n\n## Nowy\n\nB\n");
  await expect(page.getByLabel("New folder")).toBeHidden();
  await submit(page);

  const chapters = page.getByRole("list", { name: "Chapters" });
  await expect(chapters.getByRole("listitem")).toHaveCount(3);
  await expect(chapters).toContainText("Istniejący (2)");
  await expect(chapters).toContainText("Nowy");
});

const prose = (megabytes: number) => {
  const line = `– ${"Zażółć gęślą jaźń ".repeat(3)}\n\n`;
  const size = Buffer.byteLength(line);
  return line.repeat(Math.ceil((megabytes * 1024 * 1024) / size));
};

test("imports text just below the limit", async ({ page }) => {
  const text = prose(3.4);
  await openImport(page, "/stories");
  await pick(page, "a.md", `# T\n\n## Raz\n\n${text}## Dwa\n\nB\n`);
  await expect(page.getByLabel("New folder")).toHaveValue("T");
  await submit(page);
  await expect(page).toHaveURL(/\/folders\/[0-9a-f]{24}$/);
  await expect(
    page.getByRole("list", { name: "Chapters" }).getByRole("listitem"),
  ).toHaveCount(2);
});

test("refuses text over the limit", async ({ page }) => {
  await openImport(page, "/stories");
  await pick(page, "a.md", `# T\n\n${prose(3.6)}`);
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText(
    "This text is too large to import.",
  );
});

test("warns that a PDF loses its formatting", async ({ page }) => {
  const id = await seedStory("alice", { title: "P", content: "Tekst" });
  await page.goto(`/stories/${id}`);
  await page.getByRole("button", { name: "Export as…" }).click();
  await page.getByLabel("Format").selectOption("pdf");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const file = await readFile(await (await downloadPromise).path());

  await openImport(page, "/stories");
  await pick(page, "a.pdf", file);
  await expect(page.getByText("Formatting cannot be kept")).toBeVisible();
});

test("explains why a file cannot be imported", async ({ page }) => {
  await openImport(page, "/stories");
  await pick(page, "a.exe", "x");
  await expect(page.getByRole("alert")).toHaveText(
    "Unsupported file type: .exe.",
  );
  await expect(
    page.getByRole("button", { name: "Import", exact: true }),
  ).toBeDisabled();
});
