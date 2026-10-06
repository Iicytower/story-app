export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
// Never the database from .env.local (testing.md).
export const E2E_MONGODB_URI = "mongodb://127.0.0.1:27017/story_app_e2e";

export const USERS = {
  alice: { email: "alice@example.com", password: "alice-password" },
  bob: { email: "bob@example.com", password: "bob-password" },
} as const;

export type UserName = keyof typeof USERS;

export function storageStatePath(user: UserName): string {
  return `tests/e2e/.auth/${user}.json`;
}
