# Strategia testów i weryfikacji

Obowiązuje dla każdego taska. Cel: kryteria akceptacji sprawdzane automatycznie, a nie „na oko”.

## Warstwy

| Warstwa | Narzędzie | Co testuje | Gdzie |
| --- | --- | --- | --- |
| Statyczna | ESLint, Prettier, `tsc --noEmit` | Styl, typy | cały kod |
| Jednostkowe | Vitest | Czyste funkcje: `stripComments`, frontmatter YAML, bezpieczna nazwa pliku, escapowanie regex, fragment z trafieniem, liczniki słów/znaków | `*.test.ts` obok kodu |
| Integracyjne | Vitest + MongoDB w Dockerze | Server Actions i zapytania na prawdziwej bazie testowej: kody błędów, indeksy unikalne, soft delete, izolacja użytkowników, `authorize` | `tests/integration/` |
| E2E | Playwright (Chromium) | Przepływy w przeglądarce na działającej aplikacji | `tests/e2e/` |

## Zasady

- **Każde kryterium akceptacji ma przypisany test** (sekcja „Testy” w pliku taska). Gdy testu nie da się sensownie napisać, kryterium oznaczone jest `manual` z opisem, jak je sprawdzić; wynik ręcznej weryfikacji zgłaszam przy zamknięciu taska.
- Testy integracyjne wywołują Server Actions bezpośrednio jako funkcje; sesja jest mockowana (`vi.mock` modułu z `requireUser()`), żeby testować różnych użytkowników i brak sesji.
- Każdy plik testów integracyjnych dostaje czystą bazę (drop przed testem); indeksy budowane przez `syncIndexes()`, żeby testy wykrywały błędne definicje indeksów.
- Baza testowa: kontener `mongo` z `docker-compose.yml`, uruchamiany automatycznie w `globalSetup` (`docker compose up -d --wait mongo`). Każdy worker Vitest ma osobną bazę `story_app_test_<worker>` (helper `tests/integration/test-db.ts`).
- E2E: osobna baza `story_app_e2e` na tym samym kontenerze (uruchamiany w `globalSetup` Playwrighta), seed dwóch użytkowników testowych, aplikacja startowana przez `webServer` Playwrighta. Nigdy nie używa bazy z `.env.local`.
- Izolacja użytkowników (decisions.md D1) testowana dla **każdej** akcji i strony operującej na opowiadaniu: cudze → `NOT_FOUND`/404.
- Testy piszę w ramach taska, którego dotyczą, nie „na końcu”.

## Skrypty npm

- `npm test` – Vitest (jednostkowe + integracyjne).
- `npm run test:e2e` – Playwright.
- `npm run verify` – `lint` → `typecheck` → `test` → `test:e2e`. Musi przejść przed commitem taska.

## Zależności (instalacja tylko po zgodzie użytkownika)

- `vitest` – task 01
- `mongoose` – task 02 (testy używają MongoDB w Dockerze, bez dodatkowych pakietów)
- `@playwright/test` + `npx playwright install chromium` – task 05

## Zamknięcie taska

1. `npm run verify` przechodzi.
2. W odpowiedzi do użytkownika: lista kryteriów akceptacji → test, który je pokrywa (lub wynik weryfikacji `manual`).
3. Status `[x]`, commit.
