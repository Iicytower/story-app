import en from "@/messages/en.json";
import { seedFolderVersion, seedModerationLog, seedPublished } from "./db";
import { storageStatePath } from "./env";
import { expect, test } from "./helpers";

test.use({
  storageState: storageStatePath("alice"),
  timezoneId: "Europe/Warsaw",
});

// 11:00 in Warsaw (UTC+1 in March), 10:00 UTC.
const AT = new Date("2026-03-10T10:00:00.000Z");

test("the same moment shows the same local hour on the versions and in the moderation log", async ({
  page,
}) => {
  await seedPublished("alice", "Book", [
    { title: "One", publication: "public" },
  ]);
  const folderId = await seedFolderVersion("alice", "Book", {
    number: 1,
    name: "Draft",
    createdAt: AT,
  });
  await seedModerationLog("alice", "dave", AT);

  await page.goto(`/en/books/${folderId}`);
  await expect(
    page.getByRole("list", { name: "Versions" }).getByRole("time"),
  ).toHaveText("Mar 10, 2026, 11:00 AM");

  await page.goto(`/en/books/${folderId}/versions/1`);
  await expect(page.getByRole("time")).toHaveText("Mar 10, 2026, 11:00 AM");

  await page.goto("/en/moderation?tab=log");
  await expect(
    page.getByRole("list", { name: en.moderation.logList }).getByRole("time"),
  ).toHaveText("Mar 10, 2026, 11:00 AM");
});
