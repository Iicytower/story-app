import en from "@/messages/en.json";
import { countFollows, seedFollow } from "./db";
import { storageStatePath, USERS } from "./env";
import type { Page } from "@playwright/test";
import { expect, loginAs, test } from "./helpers";

const profile = en.profile;

const followButton = (page: Page) =>
  page.getByRole("button", { name: profile.follow, pressed: false });
const followingButton = (page: Page) =>
  page.getByRole("button", { pressed: true });

test.describe("as a user", () => {
  test.use({ storageState: storageStatePath("dave") });

  test("follows and unfollows an author, and the lists follow", async ({
    page,
    browser,
  }) => {
    await page.goto("/en/p/Alice");
    await expect(page.getByRole("link", { name: "0 followers" })).toBeVisible();
    await followButton(page).click();
    await expect(followingButton(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "1 follower" })).toBeVisible();
    await page.reload();
    // The pointer stays where Follow was clicked, and hovering shows Unfollow.
    await page.mouse.move(0, 0);
    await expect(followingButton(page)).toHaveAccessibleName(profile.following);
    await followingButton(page).hover();
    await expect(followingButton(page)).toHaveAccessibleName(profile.unfollow);
    expect(await countFollows()).toBe(1);

    await page.getByRole("link", { name: "1 follower" }).click();
    await expect(page).toHaveURL("/en/p/Alice/followers");
    await expect(page).toHaveTitle("Alice: followers – Story App");
    const followers = page.getByRole("list", { name: profile.followers });
    await expect(followers.getByRole("link")).toHaveText(["Dave"]);
    await followers.getByRole("link", { name: "Dave" }).click();
    await expect(page).toHaveURL("/en/p/Dave");
    await expect(page.getByRole("link", { name: "Following 1" })).toBeVisible();
    // No Follow button on one's own profile.
    await expect(
      page.getByRole("button", { name: profile.follow }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Following 1" }).click();
    await expect(
      page
        .getByRole("list", { name: profile.followedAccounts })
        .getByRole("link"),
    ).toHaveText(["Alice"]);

    // Alice sees her follower but no button state of Dave's.
    const alice = await loginAs(browser, "alice");
    await alice.page.goto("/en/p/Alice/followers");
    await expect(
      alice.page
        .getByRole("list", { name: profile.followers })
        .getByRole("link"),
    ).toHaveText(["Dave"]);
    await alice.context.close();

    await page.goto("/en/p/Alice");
    await followingButton(page).click();
    await expect(followButton(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "0 followers" })).toBeVisible();
    expect(await countFollows()).toBe(0);
    await page.goto("/en/p/Alice/followers");
    await expect(page.getByText(profile.noFollowers)).toBeVisible();
  });
});

test.describe("as a guest", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees the counts and lists of followers and following", async ({
    page,
  }) => {
    await seedFollow("dave", "alice");
    await seedFollow("erin", "alice");
    await seedFollow("alice", "erin");
    await page.goto("/en/p/Alice");
    await expect(page.getByRole("link", { name: "2 followers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Following 1" })).toBeVisible();

    await page.goto("/en/p/Alice/followers");
    await expect(
      page.getByRole("list", { name: profile.followers }).getByRole("link"),
    ).toHaveText(["Erin", "Dave"]);
    await page.goto("/en/p/alice/following");
    await expect(page).toHaveURL("/en/p/Alice/following");
    await expect(
      page
        .getByRole("list", { name: profile.followedAccounts })
        .getByRole("link"),
    ).toHaveText(["Erin"]);
    await page.goto("/en/p/Bob/following");
    await expect(page.getByText(profile.noFollowing)).toBeVisible();
    const response = await page.goto("/en/p/Nobody/followers");
    expect(response?.status()).toBe(404);
  });

  test("gets the sign-in dialog from Follow and comes back to the profile", async ({
    page,
  }) => {
    await page.goto("/en/p/Alice");
    await page.getByRole("button", { name: profile.follow }).click();
    const dialog = page.getByRole("dialog", { name: en.auth.signIn });
    await expect(dialog).toBeVisible();
    expect(await countFollows()).toBe(0);

    await dialog.getByLabel("Nickname").fill(USERS.dave.nickname);
    await dialog.getByLabel("Password").fill(USERS.dave.password);
    await dialog.getByRole("button", { name: en.auth.signIn }).click();
    await expect(page).toHaveURL("/en/p/Alice");
    await followButton(page).click();
    await expect(followingButton(page)).toBeVisible();
    expect(await countFollows()).toBe(1);
  });
});
