# D5 – Uruchamianie E2E (2026-10-06)

Status: aktualna.

- `webServer` Playwrighta robi `next build` + `next start` na porcie 3100 z `distDir` `.next-e2e` (zmienna `NEXT_DIST_DIR`), żeby nie nadpisywać zwykłego builda. `next build` dopisał `.next-e2e/**/types` do `include` w `tsconfig.json` – zostaje.
- Zmienne (`MONGODB_URI`, `AUTH_SECRET`, `AUTH_TRUST_HOST`) ustawia `playwright.config.ts`; mają pierwszeństwo nad `.env.local`.
- `workers: 1` – wszystkie testy dzielą bazę `story_app_e2e`, a fixture `cleanStories` czyści `stories` przed każdym testem.
- Sesje `alice`/`bob` zapisywane w projekcie `setup` (`tests/e2e/auth.setup.ts`) do `tests/e2e/.auth/<user>.json`; test używa ich przez `test.use({ storageState: storageStatePath("alice") })`.
