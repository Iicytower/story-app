---
name: test-patterns
description: How tests are written in this project – Vitest integration tests on the Docker MongoDB with a mocked session, Playwright E2E with seeded users, helpers and fixtures. Use before writing or fixing any test.
---

# Wzorce testów

Zasady ogólne: `docs/testing.md`. Wzory do skopiowania (czytaj zamiast zgadywać):

## Integracyjne (`tests/integration/*.test.ts`)

- Sesja: `vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }))` i `vi.mocked(requireUser).mockResolvedValue(...)`; helper `signInAs(user)` w `beforeEach` – wzór w `tests/integration/tags.test.ts`. Brak sesji: `requireUser` odrzuca jak w tym pliku.
- `vi.mock("next/cache", () => ({ refresh: vi.fn() }))`, gdy akcja odświeża widok.
- Baza: `tests/integration/test-db.ts` (osobna baza na worker, drop przed plikiem, `syncIndexes()`).
- Akcje wołane bezpośrednio jako funkcje; sprawdzaj cały wynik `{ ok: false, error, message }`.
- Każda akcja na cudzych danych: test `NOT_FOUND` (D1). Limity: `tests/integration/rate-limit.test.ts`.
- Migracje: wzór `tests/integration/migration-007.test.ts`.
- Czas: `vi.useFakeTimers()` / `vi.setSystemTime()` dla okien edycji, banów i TTL-i liczonych w kodzie.
- `after()` z `next/server` jest zmockowany globalnie (`tests/setup/next-server.ts`): zadania czekają w kolejce. Przed sprawdzeniem odroczonych zapisów (np. powiadomień) wołaj `await flushAfter()`; resztę dopłukuje globalny `afterEach`.

## E2E (`tests/e2e/*.spec.ts`)

- Import `test`, `expect` z `tests/e2e/helpers.ts` (fixture łapie naruszenia CSP – wyjątki tylko `allowCspViolation` z uzasadnieniem).
- Konta: `USERS` w `tests/e2e/env.ts`, sesje z `storageStatePath(user)` (`auth.setup.ts`). Test, który się wylogowuje lub zmienia hasło, loguje się od nowa (`login`) – inaczej unieważni sesję innym testom (D75).
- Dane: helpery w `tests/e2e/db.ts` (`withE2EDb`, `seedFolder`, `seedStory`, …); nowe seedy dopisuj tam.
- Kilku użytkowników w jednym teście: `browser.newContext({ storageState: storageStatePath("bob") })`.
- Serwer narzędzi: atrapa `tests/e2e/fake-tools.mjs`; nowe endpointy dopisuj do niej, nigdy prawdziwy serwer.
- Adres klienta dla limitów: nagłówek `E2E_IP_HEADER` (`tests/e2e/env.ts`).
- Polling i czas w przeglądarce: `page.clock`.
- Selektory: role i etykiety (`getByRole`, `getByLabel`) z tekstami z `messages/en.json`.
