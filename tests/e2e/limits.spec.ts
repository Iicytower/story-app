import { seedStory } from "./db";
import { storageStatePath } from "./env";
import { expect, menuAction, test } from "./helpers";

test.use({ storageState: storageStatePath("alice") });

test("the title field takes at most 200 characters", async ({ page }) => {
  const id = await seedStory("alice", { title: "Limits" });
  await page.goto(`/stories/${id}`);
  const title = page.getByRole("textbox", { name: "Title", exact: true });
  await expect(title).toHaveAttribute("maxlength", "200");
  await title.fill("");
  await title.pressSequentially("a".repeat(205));
  await expect(title).toHaveValue("a".repeat(200));
});

test("a title stored before the limit gives a message instead of saving", async ({
  page,
}) => {
  const id = await seedStory("alice", { title: "b".repeat(250) });
  await page.goto(`/stories/${id}`);
  await page
    .getByRole("textbox", { name: "Content", exact: true })
    .fill("Some text");
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status")).toHaveText(
    "A title can have at most 200 characters.",
  );
});

test("the new folder name takes at most 200 characters", async ({ page }) => {
  await page.goto("/stories");
  await menuAction(page, "Actions", "New folder");
  await expect(
    page.getByRole("dialog", { name: "New folder" }).getByLabel("Name"),
  ).toHaveAttribute("maxlength", "200");
});
