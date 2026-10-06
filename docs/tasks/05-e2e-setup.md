# 05 – Infrastruktura E2E (Playwright)

Strategia: [`../testing.md`](../testing.md).

## Zakres

- `@playwright/test`, przeglądarka Chromium (po zgodzie użytkownika).
- `playwright.config.ts`: `webServer` startuje aplikację (`build` + `start` lub `dev`) z `MONGODB_URI` wskazującym na bazę testową.
- `globalSetup`: kontener `mongo` z `docker-compose.yml` (D3), czysta baza `story_app_e2e`, seed dwóch użytkowników (`alice`, `bob`) z znanymi hasłami; `globalTeardown` usuwa bazę.
- Helper logowania (zapis `storageState` per użytkownik), helper czyszczenia kolekcji `stories` między testami.
- Skrypty `test:e2e` i `verify` w `package.json`.
- Katalog wyników Playwrighta w `.gitignore`.

## Kryteria akceptacji

- `npm run test:e2e` uruchamia się bez zależności od `.env.local`.
- `npm run verify` uruchamia wszystkie warstwy.

## Testy

- `tests/e2e/auth.spec.ts` (przeniesione z kryteriów taska 04):
  - niezalogowany na `/stories` → `/login`,
  - błędne hasło → komunikat; poprawne → `/stories`,
  - `/` → `/stories`,
  - wylogowanie (gdy powstanie nagłówek w 06 – dopisać tam).
