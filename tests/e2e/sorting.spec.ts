import { seedFolder, seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("switches folder sort modes and moves a folder up in manual mode", async ({
  page,
}) => {
  await seedFolder("alice", "banana", new Date("2026-01-03"));
  await seedFolder("alice", "Apple", new Date("2026-01-01"));
  await seedFolder("alice", "cherry", new Date("2026-01-02"));

  await page.goto("/stories");
  const folders = page.getByRole("list", { name: "Folders" });
  const names = folders.getByRole("listitem").locator("a > span:first-child");
  const sort = page.getByLabel("Sort folders");
  await expect(sort).toHaveValue("updated");
  await expect(names).toHaveText(["banana", "cherry", "Apple"]);
  await expect(page.getByRole("button", { name: /^Move .* up$/ })).toHaveCount(
    0,
  );

  await sort.selectOption("alpha");
  await expect(names).toHaveText(["Apple", "banana", "cherry"]);

  await sort.selectOption("manual");
  await expect(names).toHaveText(["Apple", "banana", "cherry"]);
  await expect(
    page.getByRole("button", { name: "Move Apple up" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Move cherry down" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Move cherry up" }).click();
  await expect(names).toHaveText(["Apple", "cherry", "banana"]);

  await page.reload();
  await expect(sort).toHaveValue("manual");
  await expect(names).toHaveText(["Apple", "cherry", "banana"]);
});

test("switches chapter sort modes and moves a chapter up in manual mode", async ({
  page,
}) => {
  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  await seedStory("alice", {
    title: "banana",
    folder: "Book",
    createdAt: day(1),
  });
  await seedStory("alice", {
    title: "Apple",
    folder: "Book",
    createdAt: day(3),
  });
  await seedStory("alice", {
    title: "cherry",
    folder: "Book",
    createdAt: day(2),
  });

  await page.goto("/stories");
  await page.getByRole("link", { name: /^Book/ }).click();
  const titles = page
    .getByRole("list", { name: "Chapters" })
    .getByRole("listitem")
    .locator("a > span:first-child");
  const sort = page.getByLabel("Sort chapters");
  await expect(sort).toHaveValue("created");
  await expect(titles).toHaveText(["Apple", "cherry", "banana"]);

  await sort.selectOption("alpha");
  await expect(titles).toHaveText(["Apple", "banana", "cherry"]);

  await sort.selectOption("manual");
  await expect(titles).toHaveText(["Apple", "banana", "cherry"]);
  await expect(
    page.getByRole("button", { name: "Move Apple up" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Move banana up" }).click();
  await expect(titles).toHaveText(["banana", "Apple", "cherry"]);

  await page.reload();
  await expect(sort).toHaveValue("manual");
  await expect(titles).toHaveText(["banana", "Apple", "cherry"]);
});
