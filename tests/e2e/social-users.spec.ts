import { seedFolder, withE2EDb } from "./db";
import { USERS } from "./env";
import { expect, loginAs, test } from "./helpers";

test("dave and erin are signed in side by side, each with their own data", async ({
  browser,
}) => {
  await seedFolder("dave", "Dave's book");
  await seedFolder("erin", "Erin's book");
  const dave = await loginAs(browser, "dave");
  const erin = await loginAs(browser, "erin");
  try {
    for (const [{ page }, own, other] of [
      [dave, "Dave's book", "Erin's book"],
      [erin, "Erin's book", "Dave's book"],
    ] as const) {
      await page.goto("/books");
      await expect(page).toHaveURL("/en/books");
      await expect(page.getByRole("link", { name: own })).toBeVisible();
      await expect(page.getByRole("link", { name: other })).toHaveCount(0);
    }
  } finally {
    await dave.context.close();
    await erin.context.close();
  }
});

test("the admin account has the admin role and can sign in", async ({
  browser,
}) => {
  const role = await withE2EDb(async (connection) => {
    const users = await connection
      .collection("users")
      .find({}, { projection: { nickname: 1, role: 1 } })
      .toArray();
    return Object.fromEntries(users.map((user) => [user.nickname, user.role]));
  });
  expect(role[USERS.admin.nickname]).toBe("admin");
  expect(role[USERS.dave.nickname]).toBeUndefined();
  expect(role[USERS.erin.nickname]).toBeUndefined();

  const admin = await loginAs(browser, "admin");
  try {
    await admin.page.goto("/books");
    await expect(admin.page).toHaveURL("/en/books");
  } finally {
    await admin.context.close();
  }
});
