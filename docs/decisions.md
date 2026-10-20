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

## D10 – Format eksportu `.md` (2026-10-06)

- Frontmatter generowany bez biblioteki: każda wartość (także daty ISO 8601) jako YAML double-quoted przez `JSON.stringify`, z dodatkowym escapowaniem znaków, które YAML uznaje za niedrukowalne lub za koniec linii (`U+007F–U+009F`, `U+2028`, `U+2029`, `U+FEFF`, `U+FFFE`, `U+FFFF`). Pakiet `yaml` (devDependency) tylko do parsowania w testach.
- Po frontmatterze pusta linia, potem treść bez zmian.
- Nazwa pliku: małe litery, transliteracja polskich znaków, usunięte inne diakrytyki, ciągi pozostałych znaków → `-`, max 100 znaków, fallback `story.md`.
- Bez sesji Route Handler zwraca 401 (w praktyce proxy wcześniej przekierowuje na `/login`).
- Przycisk „Export .md”: przy pustym tytule komunikat „Title is required.” bez zapisu i pobierania; w innym przypadku zapis przez tę samą kolejkę co autozapis – zawsze wywołuje `saveStory`, także bez lokalnych zmian, żeby wykryć konflikt z inną kartą – a po sukcesie pobranie przez link z atrybutem `download`.

## D11 – Szczegóły udostępniania (2026-10-06)

- `shareToken` z `node:crypto`: `randomBytes(16).toString("base64url")` (22 znaki, 128 bitów) zamiast `nanoid` – bez nowej zależności.
- Ponowne „Share” przy włączonym udostępnianiu zwraca ten sam token (warunek `shareToken: { $exists: false }` w filtrze), więc dwie karty lub podwójny klik nie unieważniają wysłanego linku. Nowy token dopiero po „Stop sharing” i ponownym „Share”.
- `setSharing` zwraca `{ ok: true, sharePath: "/s/<token>" | null }`; pełny URL składa klient z `window.location.origin`.
- `setSharing` nie zmienia `updatedAt` (`timestamps: false`), żeby otwarty edytor nie dostał `CONFLICT` przy następnym zapisie i żeby lista nie zmieniała kolejności.
- Soft delete nie usuwa tokenu; link przestaje działać dzięki filtrowi `deletedAt: null` na stronie publicznej.
- Strona `/s/[token]` wywołuje `connection()`, żeby nie była cache'owana (inaczej link działałby po „Stop sharing”). `noindex`: `metadata.robots` (meta tag) + `X-Robots-Tag: noindex, nofollow` przez `headers()` w `next.config.ts`.
- `stripComments`: komentarz kończy się na pierwszym `-->` (jak w HTML), więc z zagnieżdżonego `<!-- a <!-- b --> c -->` zostaje ` c -->`.

## D12 – Widok mobilny edytora (2026-10-06, zmienione 2026-10-20 w D19)

- Odstępstwo od „tylko desktop” w spec: edytor obsługuje wąskie ekrany. Poniżej breakpointu `md` (768 px) na górze jest przełącznik Story / Notes / Chapters (`role="tablist"`, nazwa „View”) i widoczny jest jeden panel naraz. Do taska 06 zakładka Story pokazuje edytor z podglądem pod spodem; Notes – notatki folderu nad notatkami rozdziału, bez separatora.
- Na wąskim ekranie przyciski paska narzędzi pokazują tylko ikony (etykieta w `sr-only`), przyciski zwijania i Split są ukryte, a pola tekstowe mają `text-base`, żeby iOS nie powiększał strony przy fokusie.
- Układ (desktop lub mobile) wybiera `matchMedia` (`useSyncExternalStore`, serwer renderuje desktop), więc w DOM jest tylko jedno drzewo paneli i każde pole występuje raz. Treść, notatki i notatki folderu trzyma komponent nad oboma drzewami, więc zmiana szerokości okna ich nie gubi.

## D13 – Branche i środowiska po wersji 1.0 (2026-10-20)

- Wersja 1.0 na produkcji oznaczona tagiem `v1.0.0`. Taski 01–13 usunięte z `docs/tasks/`; nowe taski numerowane od 01.
- Przepływ: `feature/NN-<slug>` (ze `staging`) → `staging` → `main`. `main` to produkcja, `staging` to środowisko testowe na Vercelu (Preview przypięty do brancha). Na `main` nigdy nie pushujemy z lokalnego repo; merge `staging` → `main` robi użytkownik przy wydaniu (+ tag `vX.Y.Z`).
- Staging używa osobnej bazy `story-app-staging` (produkcja: `story-app`) w tym samym klastrze Atlasa i własnego `AUTH_SECRET`. Szczegóły: [`deploy.md`](deploy.md).

## D14 – System migracji (2026-10-20)

- Własny mechanizm bez nowych pakietów: `migrations/NNN-<slug>.ts` (eksport `id` równy nazwie pliku, `collections`, `up(db)` na natywnym driverze), logika w `lib/migrate.ts`, CLI `scripts/migrate.ts` (`npm run migrate` lokalnie). Wykonane migracje zapisywane w kolekcji `migrations` (`_id: id`, `appliedAt`). Bez `down`: rollback to „Promote” poprzedniego deploymentu + odtworzenie danych z kopii.
- Kolejność: blokada → dla każdej niezapisanej migracji (wg `id`): kopia → `up` → zapis w `migrations` → usunięcie starszych kopii → `connection.syncIndexes()` (zawsze, także bez nowych migracji) → zwolnienie blokady. Migracja z `repeatable: true` wykonuje `up` przy każdym uruchomieniu, a kopię i zapis w `migrations` tylko za pierwszym razem (D16).
- Indeksami zarządza tylko skrypt migracji: `connectDB` łączy się z `autoIndex: false`. Wszystkie modele rejestruje `lib/models/index.ts` (importowany przez CLI i setup testów), bo `syncIndexes()` obejmuje tylko zarejestrowane modele. Lokalnie po zmianie schematu trzeba uruchomić `npm run migrate`.
- Migracje są expand-only (tylko dodawanie pól, uzupełnianie danych, nowe indeksy), bo stary deployment obsługuje ruch w trakcie builda i po rollbacku. Usunięcie lub zmiana nazwy pola najwcześniej w kolejnym wydaniu.
- Blokada: atomowy `insertOne({ _id: "lock", startedAt })` w `migrations`; duplikat → błąd „Another migration is in progress”. Blokadę starszą niż 15 min przejmuje `findOneAndUpdate` z warunkiem na stary `startedAt` (przejmuje tylko jeden proces). Zwalniana tylko własna blokada (warunek na `startedAt`).
- Kopia: `aggregate([{ $out: "<kolekcja>_backup_<id>" }])`. `$out` nie jest na liście nieobsługiwanych poleceń Atlas M0 (dokumentacja tego wprost nie potwierdza). Błąd kopii przerywa migrację przed `up`, więc dane są bezpieczne. Dla nieistniejącej kolekcji `$out` tworzy pustą kopię. Jeśli kopia już istnieje (ponowna próba po nieudanym `up`), nie jest nadpisywana, żeby nie zastąpić czystego stanu częściowo zmigrowanymi danymi. Po udanej migracji zostają kopie 3 ostatnich migracji (wg `id`).
- Uruchamianie na Vercelu: `buildCommand` w `vercel.json` (`tsx scripts/migrate.ts && next build`). Dokumentacja Vercela opisuje `buildCommand`, ale nie `vercel-build`. Skrypt `build` w `package.json` zostaje `next build` (lokalnie i w E2E bez migracji). Warunek (`decideMigration`): brak `VERCEL_ENV` (lokalnie) → migruje; `production` i `preview` z `VERCEL_GIT_COMMIT_REF=staging` → migruje, a bez `MONGODB_URI` kończy build błędem; pozostałe → pomija z komunikatem w logu.
- `001-baseline`: pusta migracja z kopią `stories` i `users`. Pierwszy build stagingu sprawdza `$out` na M0, zanim zaczną od niego zależeć migracje z danymi.

## D15 – Branch `develop` (2026-10-20)

Zmienia przepływ z D13: `feature/NN-<slug>` (z `develop`) → `develop` → `staging` → `main`.

- Zakończony task jest mergowany do `develop`. Push `develop` oraz merge `develop` → `staging` (i push `staging`) Claude robi tylko na prośbę użytkownika. Merge `staging` → `main` dalej robi wyłącznie użytkownik.
- Preview Vercela dla `develop` nie ma zmiennych środowiskowych, więc nie łączy się z bazą, a migracje są pomijane (D14).

## D16 – Foldery (2026-10-20)

- Kolekcja `folders`: `userId`, `name`, `notes`, `notesUpdatedAt`, `lastActivityAt`, `deletedAt`, `createdAt`, `updatedAt`. Indeksy: unikalny częściowy `{ userId, name }` (filtr `deletedAt: { $type: "null" }`) i `{ userId, lastActivityAt: -1 }`. W UI opowiadanie w folderze nazywamy rozdziałem, ale model i ścieżki zostają (`stories`, `/stories/[id]`).
- `stories.folderId` wymagane. Unikalność tytułu zmienia się na `{ userId, folderId, title }` (ten sam filtr). Komunikat duplikatu: „A story with this title already exists in this folder.”. Nowe kody błędów: `DUPLICATE_NAME`, `EMPTY_NAME`.
- „New story” ma dwa pola: Folder (input z `datalist` istniejących folderów, wstępnie wypełniony folderem z największym `lastActivityAt` albo bieżącym folderem) i Title. `createStory(title, folderName)` szuka aktywnego folderu użytkownika po nazwie (po `trim()`, z rozróżnianiem wielkości liter, tak jak indeks), a gdy go nie ma, tworzy nowy. Tytuł i nazwa są sprawdzane przed utworzeniem folderu, więc odrzucony rozdział nie zostawia pustego folderu. Wyścig dwóch tworzeń kończy się ponownym odczytem po duplikacie.
- `lastActivityAt` ustawiają: `saveStory` (na nowy `updatedAt` rozdziału), `saveFolderNotes`, `createStory`, `moveStory` (folder docelowy). Wartość tylko rośnie. Konflikt notatek folderu sprawdzamy wyłącznie po `notesUpdatedAt`, jak w D9 (zapis tylko przy równej wartości, nowa to `max(now, expected + 1 ms)`).
- `moveStory`, `renameFolder` i `deleteFolder` nie zmieniają `updatedAt` rozdziałów (`timestamps: false`). `deleteFolder` ustawia `deletedAt` folderu i jego aktywnych rozdziałów (ta sama data), co wyłącza też udostępnione linki.
- Kolejność rozdziałów i folderów: D17.
- `/stories`: bez zapytania lista folderów, z zapytaniem wyniki wyszukiwania globalnego z nazwą folderu („in <folder>”). Daty na listach renderuje komponent `LocalDate`: na serwerze w UTC, po hydratacji w strefie przeglądarki.
- Akcje modyfikujące listy wywołują `refresh()` z `next/cache` (odświeża bieżącą stronę), zamiast `revalidatePath("/stories")`, bo usuwanie i przenoszenie działa też na `/folders/[id]`.
- Migracja `002-folders` jest powtarzalna (`repeatable: true`, D14 rozszerzone): runner wykonuje `up` przy każdym uruchomieniu, a kopię robi tylko przed pierwszym. Opowiadania bez `folderId` (także usunięte) trafiają do aktywnego folderu „Unsorted” użytkownika (tworzonego, gdy go nie ma). `lastActivityAt` nowego folderu to najnowszy `updatedAt` jego aktywnych opowiadań. Gdy tytuł już istnieje w „Unsorted” (stary kod mógł go utworzyć po usunięciu indeksu `{ userId, title }`), opowiadanie dostaje sufiks „ (2)”, „ (3)” itd.
- Opowiadanie bez folderu (utworzone przez v1.0 w trakcie builda, przed kolejnym uruchomieniem migracji) działa w edytorze bez linku powrotnego, a w wynikach wyszukiwania ma pustą nazwę folderu.

## D17 – Tryby sortowania (2026-10-20)

- `users.folderSort`: `updated` (domyślny, `lastActivityAt` malejąco) | `manual` | `alpha`. `folders.chapterSort`: `created` (domyślny, `createdAt` malejąco) | `manual` | `alpha`. Remis rozstrzyga `_id`. Specyfikacje sortowania w `lib/folders/sort.ts` (`folderOrder`, `chapterOrder`); kolejność rozdziałów w eksporcie, udostępnieniu i panelu Chapters (04, 05) bierze się z `chapterOrder` i `findChaptersInOrder`.
- `alpha`: kolacja `{ locale: "pl", strength: 2 }` – siła 2 ignoruje wielkość liter („a” = „A”, remis po `_id`), domyślna 3 tylko ustawia je obok siebie.
- `position` (folder, rozdział) jest ustawiane zawsze, także poza trybem manual: nowy element i rozdział przeniesiony „Move to…” dostaje `max + 1` w swojej grupie.
- Pierwsze przełączenie na manual zapisuje pozycje według kolejności widocznej w dotychczasowym trybie i ustawia flagę `users.manualFolderOrder` / `folders.manualChapterOrder`. Kolejne przełączenia zachowują ręczną kolejność. Pozycje z migracji same by nie wystarczyły, bo `lastActivityAt` zmienia się po migracji.
- Move up / down przenumerowuje całą listę (0..n-1) zamiast zamieniać dwie wartości, bo pozycje mogą być równe (równoległe tworzenie) albo ich brak (dokumenty starego deploymentu). Na końcach listy akcja nic nie zmienia i zwraca `ok`. Przyciski są widoczne tylko w trybie manual.
- Zmiana trybu i kolejności nie zmienia `updatedAt` rozdziałów, `lastActivityAt` ani `notesUpdatedAt` folderu (pozycje zapisuje natywny `bulkWrite`, tryb rozdziałów `timestamps: false`). Nowy kod błędu `INVALID_INPUT` dla nieznanego trybu lub kierunku.
- Migracja `003-positions` (kopia `stories`, `folders`, `users`) jest powtarzalna jak `002`: uzupełnia brakujące `folderSort`/`chapterSort` (z flagą `false`) i dopisuje `position` dokumentom bez niej, za istniejącymi pozycjami grupy, w kolejności trybów domyślnych. Dokumenty starego deploymentu z okna builda dostają pozycje przy kolejnym deployu; do tego czasu w trybie manual są na początku listy.
- Domyślny folder w „New story” na `/stories` to nadal folder z największym `lastActivityAt`, niezależnie od trybu listy.

## D18 – Eksport i udostępnianie folderu (2026-10-20)

- `GET /folders/[id]/export`: zip budowany w pamięci przez `fflate` (`zipSync`). Rozdziały w kolejności `chapterSort` jako `NN-<nazwa>.md` (numer od 1, dopełniony zerami do liczby cyfr liczby rozdziałów, min. 2; nazwa jak w D10, fallback `chapter`), frontmatter jak w D10. Numer rozróżnia też rozdziały o tej samej nazwie pliku.
- `notes.md`: frontmatter `title` (nazwa folderu), `createdAt` (folderu), `updatedAt` (`notesUpdatedAt`), potem notatki folderu bez zmian. Archiwum: `<nazwa folderu>.zip` (fallback `folder.zip`). Komentarze HTML zostają w eksporcie, jak w D10.
- `folders.shareToken`: jak D11 (osobny unikalny indeks częściowy, ten sam token przy ponownym „Share”, `timestamps: false`, `lastActivityAt` bez zmian). `setFolderSharing` zwraca `sharePath: "/s/f/<token>" | null`. Udostępnianie folderu i rozdziałów jest niezależne.
- `/s/f/[token]`: nazwa folderu i numerowany spis. `/s/f/[token]/[n]`: rozdział `n` (od 1, w bieżącej kolejności folderu) z linkami poprzedni / „Contents” / następny; `n` spoza zakresu lub nieliczbowe → 404. Numery zmieniają się razem z kolejnością i usuwaniem rozdziałów. Obie strony: `connection()`, `metadata.robots`, `X-Robots-Tag` w `next.config.ts`, `stripComments`, bez notatek. `isPublicPath` obejmuje `/s/f/<token>` i `/s/f/<token>/<n>`.
- Przyciski w widoku folderu: „Export .zip” (link z `download`, bez zapisu – folder nie ma niezapisanych zmian poza autozapisywanymi notatkami) i „Share” / „Stop sharing” z polem linku i „Copy link”.

## D19 – Panele edytora (2026-10-20)

- Desktop: `[Story] | [panel boczny]` w `ResizablePanelGroup` (shadcn Resizable, `react-resizable-panels` v4). Story to edytor z podglądem (do taska 06). Panel boczny ma zakładki Notes / Chapters (`tablist` „Side panel”, domyślnie Notes). „Split” w pasku narzędzi (`aria-pressed`) pokazuje obie kolumny; „Move left/right” w nagłówku kolumny zmienia ich kolejność (Story zawsze pierwsza). „Hide notes/chapters” zwija kolumnę, a „Show …” zostaje przy prawej krawędzi.
- Notes: pionowa grupa – notatki folderu (`useFolderNotes`, osobna kolejka i stan zapisu, konflikt po `notesUpdatedAt`) nad notatkami rozdziału (zapisywanymi z rozdziałem przez `saveStory`, nazwa pola „Notes” bez zmian). Status notatek folderu nie ma `role="status"` (unikalny status edytora zostaje dla rozdziału), tylko `aria-live`.
- Układ w `localStorage` (`story-app:editor-layout`): split, zakładka, kolejność, zwinięcia, szerokości per zestaw widocznych kolumn, wysokości notatek. Parsowanie pole po polu z wartościami domyślnymi; każdy dostęp do `localStorage` w `try/catch` (także getter `window.localStorage`). Magazyn na poziomie modułu (`useSyncExternalStore`) trzyma układ w pamięci, więc bez `localStorage` działa do przeładowania. Szerokości zapisywane tylko po interakcji użytkownika (`meta.isUserInteraction`, `requestedLayout`). Grupy są remontowane po hydratacji i przy zmianie zestawu kolumn, bo `defaultLayout` jest czytany tylko przy montowaniu. Id paneli mają sufiks (`notes-column`), bo biblioteka ustawia je jako DOM `id`.
- `ThemeToggle` też łapie wyjątki `localStorage` (wcześniej wyjątek przerywał renderowanie aplikacji).
- Chapters: rozdziały folderu w kolejności `chapterSort`, bieżący z `aria-current="page"`. Przejście, „New chapter” (dialog z tytułem) najpierw zapisują rozdział i notatki folderu (kolejki autozapisu); pusty tytuł („Title is required.”) albo błąd zapisu zatrzymują przejście z komunikatem. Move up / down w trybie manual, Delete z potwierdzeniem; usunięcie bieżącego przenosi do widoku folderu.
- `Editor` jest renderowany z `key={story.id}`, żeby przejście do innego rozdziału nie zostawiło w stanie tekstu poprzedniego.
