import { test as setup } from "@playwright/test";
import { USERS, storageStatePath, type UserName } from "./env";
import { login } from "./helpers";

for (const user of Object.keys(USERS) as UserName[]) {
  setup(`sign in as ${user}`, async ({ page }) => {
    await login(page, user);
    await page.context().storageState({ path: storageStatePath(user) });
  });
}
