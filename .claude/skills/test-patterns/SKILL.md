---
name: test-patterns
description: How tests are written in this project – Vitest integration tests on the Docker MongoDB with a mocked session, Playwright E2E with seeded users, helpers and fixtures. Use before writing or fixing any test.
---

# Test patterns

General rules: `docs/testing.md`. Patterns to copy (read them instead of guessing):

## Integration (`tests/integration/*.test.ts`)

- Session: `vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }))` and `vi.mocked(requireUser).mockResolvedValue(...)`; helper `signInAs(user)` in `beforeEach` – pattern in `tests/integration/tags.test.ts`. No session: `requireUser` rejects as in that file.
- `vi.mock("next/cache", () => ({ refresh: vi.fn() }))` when the action refreshes the view.
- Database: `tests/integration/test-db.ts` (separate database per worker, dropped before the file, `syncIndexes()`).
- Actions are called directly as functions; check the whole `{ ok: false, error, message }` result.
- Every action on someone else's data: a `NOT_FOUND` test (D1). Limits: `tests/integration/rate-limit.test.ts`.
- Migrations: pattern `tests/integration/migration-007.test.ts`.
- Time: `vi.useFakeTimers()` / `vi.setSystemTime()` for edit windows, bans and TTLs computed in code.
- `after()` from `next/server` is mocked globally (`tests/setup/next-server.ts`): jobs wait in a queue. Before checking deferred writes (e.g. notifications) call `await flushAfter()`; the global `afterEach` flushes the rest.

## E2E (`tests/e2e/*.spec.ts`)

- Import `test`, `expect` from `tests/e2e/helpers.ts` (the fixture catches CSP violations – exceptions only via `allowCspViolation` with a reason).
- Accounts: `USERS` in `tests/e2e/env.ts`, sessions from `storageStatePath(user)` (`auth.setup.ts`). A test that logs out or changes the password logs in again (`login`) – otherwise it invalidates the session for other tests (D75).
- Data: helpers in `tests/e2e/db.ts` (`withE2EDb`, `seedFolder`, `seedStory`, …); add new seeds there.
- Several users in one test: `browser.newContext({ storageState: storageStatePath("bob") })`.
- Tools server: the fake `tests/e2e/fake-tools.mjs`; add new endpoints to it, never the real server.
- Client address for limits: the `E2E_IP_HEADER` header (`tests/e2e/env.ts`).
- Polling and time in the browser: `page.clock`.
- Selectors: roles and labels (`getByRole`, `getByLabel`) with strings from `messages/en.json`.
