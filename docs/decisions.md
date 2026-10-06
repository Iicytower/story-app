# Decyzje i odstępstwa od specyfikacji

Ustalenia podjęte po napisaniu `spec.md`. W razie sprzeczności ten plik ma pierwszeństwo.

## D1 – Konta w kolekcji `users`, wielu użytkowników (2026-10-06)

Spec zakłada jedno konto i jedną kolekcję `stories`. Zmiana: konta trzymamy w kolekcji `users`, a aplikacja działa dla dowolnej liczby kont. Nowy użytkownik = nowy wpis (przez skrypt seedujący), bez zmian w kodzie.

- `users`: `email` (unikalny, zapisywany małymi literami), `passwordHash` (`bcryptjs`), `createdAt`.
- `stories`: nowe pole `userId` (ObjectId, wymagane, ref `User`).
- Każde opowiadanie należy do jednego użytkownika. Użytkownik widzi, edytuje, usuwa, eksportuje i udostępnia tylko swoje opowiadania. Cudze opowiadanie traktowane jak nieistniejące (`NOT_FOUND` / 404).
- Unikalność tytułu w obrębie użytkownika: unikalny indeks częściowy na `{ userId, title }` z filtrem `{ deletedAt: { $type: "null" } }`.
- Indeks listy: `{ userId: 1, updatedAt: -1 }`.
- Sesja JWT przechowuje `id` użytkownika; każda Server Action i Route Handler pobiera `userId` z sesji (nigdy z wejścia klienta).
- Strona publiczna `/s/[token]` szuka tylko po `shareToken` (token globalnie unikalny).
- Skrypt seedujący dodaje nowe konto; jeśli e-mail istnieje, pyta, czy zmienić hasło.
- Brak rejestracji w UI (bez zmian względem spec).

## D2 – Strategia testów (2026-10-06)

Spec wymaga tylko testu `stripComments`. Rozszerzenie: testy jednostkowe (Vitest), integracyjne Server Actions i zapytań (MongoDB w Dockerze, D3) oraz E2E (Playwright, osobny task 05). Każde kryterium akceptacji ma przypisany test lub oznaczenie `manual`. Szczegóły: [`testing.md`](testing.md).

## D3 – MongoDB w Dockerze dla testów i lokalnego dev (2026-10-06)

Zamiast `mongodb-memory-server` używamy kontenera `mongo:8` z `docker-compose.yml` (port `127.0.0.1:27017`, wolumen `mongo-data`).

- Testy (Vitest, Playwright) same uruchamiają kontener w `globalSetup` (`docker compose up -d --wait mongo`) i używają osobnych baz: `story_app_test_<worker>` (integracyjne), `story_app_e2e` (E2E).
- Lokalny dev: `.env.local` wskazuje na `mongodb://127.0.0.1:27017/story_app`; start przez `npm run db:up`. Atlas tylko na produkcji.
- MongoDB wymaga min. 500 MB wolnego miejsca na dysku do budowy indeksów.

## D4 – Auth.js v5 i zmienne środowiskowe (2026-10-06)

- `next-auth@5` (beta, jedyna wersja z API dla App Router). Konfiguracja w `auth.ts`, ochrona tras w `proxy.ts` (Next.js 16: Proxy zamiast Middleware, runtime Node.js) przez callback `authorized`.
- Zmienne: `AUTH_SECRET` (wymagana). `AUTH_TRUST_HOST=true` potrzebne tylko przy `next start` poza Vercelem (np. E2E); na Vercelu i w `next dev` host jest zaufany automatycznie. `AUTH_URL` niepotrzebne.
- Odnawianie sesji: każde żądanie przechodzące przez proxy ponownie podpisuje JWT i ustawia cookie z nowym `expires` (30 dni).
- `requireUser()` nie rzuca wyjątku, tylko zwraca `{ ok: true, userId } | { ok: false, error: "UNAUTHORIZED", message }`, żeby Server Actions mogły zwrócić wynik bez `try/catch`.
- Błędne logowanie w akcji `login` zwraca kod `UNAUTHORIZED` z komunikatem „Invalid email or password.”.

## D5 – Uruchamianie E2E (2026-10-06)

- `webServer` Playwrighta robi `next build` + `next start` na porcie 3100 z `distDir` `.next-e2e` (zmienna `NEXT_DIST_DIR`), żeby nie nadpisywać zwykłego builda. `next build` dopisał `.next-e2e/**/types` do `include` w `tsconfig.json` – zostaje.
- Zmienne (`MONGODB_URI`, `AUTH_SECRET`, `AUTH_TRUST_HOST`) ustawia `playwright.config.ts`; mają pierwszeństwo nad `.env.local`.
- `workers: 1` – wszystkie testy dzielą bazę `story_app_e2e`, a fixture `cleanStories` czyści `stories` przed każdym testem.
- Sesje `alice`/`bob` zapisywane w projekcie `setup` (`tests/e2e/auth.setup.ts`) do `tests/e2e/.auth/<user>.json`; test używa ich przez `test.use({ storageState: storageStatePath("alice") })`.

## D6 – Motyw bez dodatkowych pakietów (2026-10-06)

- Bez `next-themes`: inline `<script>` w `<head>` root layoutu czyta `localStorage["theme"]` i dodaje klasę `dark` do `<html>` przed pierwszym renderem (`suppressHydrationWarning` na `<html>`).
- Domyślnie jasny motyw (bez wyboru użytkownika nie patrzymy na `prefers-color-scheme`).
- Strony chronione w grupie tras `app/(protected)/` ze wspólnym nagłówkiem; wylogowanie przez Server Action `logout` (`signOut({ redirectTo: "/login" })`).

## D7 – Tytuł przycinany (trim) (2026-10-06)

- Serwer (`createStory`, później `saveStory`) zapisuje tytuł po `trim()`. Tytuł z samych białych znaków → `EMPTY_TITLE`. Unikalność liczona po przycięciu (`" A "` koliduje z `"A"`).
- Wynik akcji typowany jako `ActionResult<T>` (`lib/action-result.ts`). Akcje opowiadań w `app/(protected)/stories/actions.ts`; nieprawidłowe `id` (nie ObjectId) → `NOT_FOUND`.

## D8 – Podgląd markdown z `skipHtml` (2026-10-06)

- `react-markdown` bez `rehype-raw` nie ukrywa surowego HTML, tylko renderuje go jako tekst (komentarze `<!-- -->` byłyby widoczne). Dlatego podgląd (`components/markdown-preview.tsx`) używa `skipHtml`: cały surowy HTML, w tym komentarze i `<script>`, jest usuwany z podglądu.
- Styl podglądu: `@tailwindcss/typography` (`prose`, w dark mode `prose-invert`).
- Edytor zajmuje pełną szerokość okna; ograniczenie `max-w-5xl` przeniesione z layoutu chronionego do strony listy.

## D9 – Szczegóły `saveStory` i autozapisu (2026-10-06)

- `EMPTY_CONTENT`: treść z samych białych znaków traktowana jak pusta (po obu stronach porównania), żeby przypadkowe zastąpienie tekstu spacją też nie nadpisało bazy.
- Konflikt: zapis przechodzi tylko, gdy `updatedAt` w bazie jest **równy** `expectedUpdatedAt` (warunek w filtrze `updateOne`, razem z warunkiem pustej treści). Nowy `updatedAt` ustawiany ręcznie (`timestamps: false`) jako `max(now, expected + 1 ms)`, żeby dwa równoległe zapisy z tym samym `expectedUpdatedAt` nigdy nie przeszły oba.
- Przyczyna nieudanego zapisu ustalana dodatkowym odczytem: brak dokumentu → `NOT_FOUND`, inny `updatedAt` → `CONFLICT`, w przeciwnym razie `EMPTY_CONTENT`.
- `saveStory` nie wywołuje `revalidatePath` (lista jest dynamiczna, a odświeżanie edytora po każdym autozapisie byłoby zbędnym odczytem).
- Klient: zapisy w kolejce (jeden naraz, każdy z `updatedAt` z poprzedniego). Ctrl+S (także Cmd+S) przy pustym tytule nic nie robi. Błąd sieci → stan błędu z komunikatem, bez ponawiania. Po konflikcie każdy kolejny zapis też zwróci konflikt, dopóki użytkownik nie przeładuje strony.
