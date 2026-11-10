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

## D12 – Widok mobilny edytora (2026-10-06, zmienione 2026-10-20 w D19, 2026-11-01 w D41)

- Odstępstwo od „tylko desktop” w spec: edytor obsługuje wąskie ekrany. Poniżej breakpointu `md` (768 px) na górze jest przełącznik Story / Notes / Chapters / Tools (D41; `role="tablist"`, nazwa „View”) i widoczny jest jeden panel naraz. Zakładka Story pokazuje edytor WYSIWYG (D20); Notes – notatki folderu nad notatkami rozdziału, bez separatora.
- Na wąskim ekranie przyciski paska narzędzi pokazują tylko ikony (etykieta w `sr-only`), przyciski zwijania i Split są ukryte, a pola tekstowe mają `text-base`, żeby iOS nie powiększał strony przy fokusie.
- Układ (desktop lub mobile) wybiera `matchMedia` (`useSyncExternalStore`, serwer renderuje desktop), więc w DOM jest tylko jedno drzewo paneli i każde pole występuje raz. Widoki Story / Notes / Chapters są zamontowane jednocześnie, a nieaktywne ukryte (D27). Treść, notatki i notatki folderu trzyma komponent nad oboma drzewami, więc zmiana szerokości okna ich nie gubi.

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

- Tryb folderów (`settings.folders.sort`, D24; pierwotnie `users.folderSort`): `updated` (domyślny, `lastActivityAt` malejąco) | `manual` | `alpha`. `folders.chapterSort`: `created` (domyślny, `createdAt` malejąco) | `manual` | `alpha`. Remis rozstrzyga `_id`. Specyfikacje sortowania w `lib/folders/sort.ts` (`folderOrder`, `chapterOrder`); kolejność rozdziałów w eksporcie, udostępnieniu i panelu Chapters (04, 05) bierze się z `chapterOrder` i `findChaptersInOrder`.
- `alpha`: kolacja `{ locale: "pl", strength: 2 }` – siła 2 ignoruje wielkość liter („a” = „A”, remis po `_id`), domyślna 3 tylko ustawia je obok siebie.
- `position` (folder, rozdział) jest ustawiane zawsze, także poza trybem manual: nowy element i rozdział przeniesiony „Move to…” dostaje `max + 1` w swojej grupie.
- Pierwsze przełączenie na manual zapisuje pozycje według kolejności widocznej w dotychczasowym trybie i ustawia flagę `settings.folders.manualOrder` (D24) / `folders.manualChapterOrder`. Kolejne przełączenia zachowują ręczną kolejność. Pozycje z migracji same by nie wystarczyły, bo `lastActivityAt` zmienia się po migracji.
- Move up / down przenumerowuje całą listę (0..n-1) zamiast zamieniać dwie wartości, bo pozycje mogą być równe (równoległe tworzenie) albo ich brak (dokumenty starego deploymentu). Na końcach listy akcja nic nie zmienia i zwraca `ok`. Przyciski są widoczne tylko w trybie manual.
- Zmiana trybu i kolejności nie zmienia `updatedAt` rozdziałów, `lastActivityAt` ani `notesUpdatedAt` folderu (pozycje zapisuje natywny `bulkWrite`, tryb rozdziałów `timestamps: false`). Nowy kod błędu `INVALID_INPUT` dla nieznanego trybu lub kierunku.
- Migracja `003-positions` (kopia `stories`, `folders`, `users`) jest powtarzalna jak `002`: uzupełnia brakujące `folderSort`/`chapterSort` (z flagą `false`) i dopisuje `position` dokumentom bez niej, za istniejącymi pozycjami grupy, w kolejności trybów domyślnych. Od D24 nie dotyka już `users` (brak trybu = domyślny). Dokumenty starego deploymentu z okna builda dostają pozycje przy kolejnym deployu; do tego czasu w trybie manual są na początku listy.
- Domyślny folder w „New story” na `/stories` to nadal folder z największym `lastActivityAt`, niezależnie od trybu listy.

## D18 – Eksport i udostępnianie folderu (2026-10-20)

- `GET /folders/[id]/export`: zip budowany w pamięci przez `fflate` (`zipSync`). Rozdziały w kolejności `chapterSort` jako `NN-<nazwa>.md` (numer od 1, dopełniony zerami do liczby cyfr liczby rozdziałów, min. 2; nazwa jak w D10, fallback `chapter`), frontmatter jak w D10. Numer rozróżnia też rozdziały o tej samej nazwie pliku.
- `notes.md`: frontmatter `title` (nazwa folderu), `createdAt` (folderu), `updatedAt` (`notesUpdatedAt`), potem notatki folderu bez zmian. Archiwum: `<nazwa folderu>.zip` (fallback `folder.zip`). Komentarze HTML zostają w eksporcie, jak w D10.
- `folders.shareToken`: jak D11 (osobny unikalny indeks częściowy, ten sam token przy ponownym „Share”, `timestamps: false`, `lastActivityAt` bez zmian). `setFolderSharing` zwraca `sharePath: "/s/f/<token>" | null`. Udostępnianie folderu i rozdziałów jest niezależne.
- `/s/f/[token]`: nazwa folderu i numerowany spis. `/s/f/[token]/[n]`: rozdział `n` (od 1, w bieżącej kolejności folderu) z linkami poprzedni / „Contents” / następny; `n` spoza zakresu lub nieliczbowe → 404. Numery zmieniają się razem z kolejnością i usuwaniem rozdziałów. Obie strony: `connection()`, `metadata.robots`, `X-Robots-Tag` w `next.config.ts`, `stripComments`, bez notatek. `isPublicPath` obejmuje `/s/f/<token>` i `/s/f/<token>/<n>`.
- Przyciski w widoku folderu: „Export .zip” (link z `download`, bez zapisu – folder nie ma niezapisanych zmian poza autozapisywanymi notatkami) i „Share” / „Stop sharing” z polem linku i „Copy link”.

## D19 – Panele edytora (2026-10-20, zmienione 2026-11-01 w D41)

- Desktop: `[Story] | [panel boczny]` w `ResizablePanelGroup` (shadcn Resizable, `react-resizable-panels` v4). Story to edytor WYSIWYG (D20). Panel boczny ma zakładki Notes / Chapters (`tablist` „Side panel”, domyślnie Notes). „Split” w pasku narzędzi (`aria-pressed`) pokazuje obie kolumny; „Move left/right” w nagłówku kolumny zmienia ich kolejność (Story zawsze pierwsza). „Hide notes/chapters” zwija kolumnę, a „Show …” zostaje przy prawej krawędzi.
- Notes: pionowa grupa – notatki folderu (`useFolderNotes`, osobna kolejka i stan zapisu, konflikt po `notesUpdatedAt`) nad notatkami rozdziału (zapisywanymi z rozdziałem przez `saveStory`, nazwa pola „Notes” bez zmian). Status notatek folderu nie ma `role="status"` (unikalny status edytora zostaje dla rozdziału), tylko `aria-live`.
- Układ w `localStorage` (`story-app:editor-layout`): split, zakładka, kolejność, zwinięcia, szerokości per zestaw widocznych kolumn, wysokości notatek. Parsowanie pole po polu z wartościami domyślnymi; każdy dostęp do `localStorage` w `try/catch` (także getter `window.localStorage`). Magazyn na poziomie modułu (`useSyncExternalStore`) trzyma układ w pamięci, więc bez `localStorage` działa do przeładowania. Szerokości zapisywane tylko po interakcji użytkownika (`meta.isUserInteraction`, `requestedLayout`). Grupy są remontowane po hydratacji i przy zmianie zestawu kolumn, bo `defaultLayout` jest czytany tylko przy montowaniu. Id paneli mają sufiks (`notes-column`), bo biblioteka ustawia je jako DOM `id`.
- `ThemeToggle` też łapie wyjątki `localStorage` (wcześniej wyjątek przerywał renderowanie aplikacji).
- Chapters: rozdziały folderu w kolejności `chapterSort`, bieżący z `aria-current="page"`. Przejście, „New chapter” (dialog z tytułem) najpierw zapisują rozdział i notatki folderu (kolejki autozapisu); pusty tytuł („Title is required.”) albo błąd zapisu zatrzymują przejście z komunikatem. Move up / down w trybie manual, Delete z potwierdzeniem; usunięcie bieżącego przenosi do widoku folderu.
- `Editor` jest renderowany z `key={story.id}`, żeby przejście do innego rozdziału nie zostawiło w stanie tekstu poprzedniego.

## D20 – Edytor WYSIWYG (2026-10-20)

- Tiptap v3 bez spike'a (zgoda użytkownika). Wymagania użytkownika: podstawowe formatowanie, komentarze w dowolnej formie, Enter = nowy akapit, listy numerowane i punktowane. Zgodność ze starymi opowiadaniami (pojedynczy Enter, stare komentarze) nie jest wymagana – użytkownik poprawi dane ręcznie. Z wyrównania i koloru tekstu (dawny task 07) rezygnujemy.
- Wspólny komponent `MarkdownEditor` dla treści, notatek rozdziału i notatek folderu (także na stronie folderu): przełącznik Preview / Source (zawsze Preview przy otwarciu, bez zapamiętywania), w Source surowy markdown w textarea. Przejście z Source do Preview wczytuje tekst (`setContent` bez `emitUpdate`), więc wartość z Source zostaje bez zmian, dopóki użytkownik nie edytuje w Preview.
- Zapis zawsze w markdownie (`@tiptap/markdown`, marked z `breaks: true, gfm: true` – pojedynczy znak nowej linii to złamanie linii, jak remark-breaks na stronach publicznych). Serializer normalizuje źródło (np. `__a__` → `**a**`, złamanie jako dwie spacje + `\n`), końcowe puste linie są obcinane. `value` zmienia się tylko w `onUpdate` (edycja), więc samo otwarcie niczego nie zapisuje.
- Skróty (odstępstwo od spec „brak skrótów”): Ctrl/Cmd+B, Ctrl/Cmd+I, Ctrl/Cmd+K (dialog linku), Undo/Redo, Enter = akapit, Shift+Enter = złamanie linii. Przyciski: Bold, Italic, H1–H3, listy, cytat, linia pozioma, link, Comment, Undo, Redo. StarterKit bez `code`, `codeBlock`, `strike`, `underline`.
- Link: tylko `http:`, `https:`, `mailto:` (`isAllowedLink` w dialogu i `isAllowedUri` rozszerzenia); inne adresy → „Use an http, https or mailto link.”. Pusty adres usuwa link.
- Komentarz: własny węzeł blokowy `comment` (wyróżniony `aside`, edytowalny, Enter = nowa linia, Enter na pustej ostatniej linii wychodzi z komentarza), w markdownie `<!-- tekst -->` w osobnym bloku. `-->` w tekście zapisywane jako `- ->`. `<!--` wewnątrz akapitu zostaje tekstem. Strony publiczne dalej usuwają komentarze `stripComments`, eksport je zachowuje.
- Surowy HTML w źródle (np. `<script>`) nie jest renderowany w edytorze (marked → token HTML, którego żadne rozszerzenie nie obsługuje).
- Edytor renderuje się dopiero po hydratacji (`immediatelyRender: false`). Pole ma `role="textbox"` i nazwę jak dawne textarea („Content”, „Notes”, „Folder notes”); grupa edytora ma nazwę „<etykieta> editor”. Kolumna podglądu (`MarkdownPreview`) zniknęła z edytora; komponent zostaje dla stron publicznych.

## D21 – Sprawdzanie pisowni (2026-10-21)

- Opowiadania tylko po polsku; tekst nie opuszcza przeglądarki; bez kosztów. Stąd tylko wbudowany spellcheck przeglądarki (`lang="pl"`, `spellcheck`) na polach tekstu opowiadania; UI zostaje `lang="en"`.
- Gramatyka i interpunkcja (LanguageTool – publiczne API, Premium lub własny serwer; LLM) odłożone do backlogu: wymagają wysłania tekstu poza przeglądarkę albo płatnego hostingu.

## D22 – Rzadszy autozapis (2026-10-21)

- Zmienia spec („około 3 s”): autozapis 20 s po ostatnim naciśnięciu klawisza (`AUTOSAVE_DELAY_MS` w `lib/autosave.ts`) w edytorze rozdziału i w notatkach folderu. Przy ciągłym pisaniu zapis czeka na przerwę.
- Ukrycie karty (`visibilitychange` → `hidden`) zapisuje od razu przez tę samą kolejkę; bez zmian i przy pustym tytule nie wysyła żądania. Ctrl+S, `beforeunload` i zapis przed zmianą rozdziału bez zmian.
- E2E przewijają czas `page.clock` zamiast czekać.

## D23 – Ustawienia użytkownika (2026-10-21)

- Zmienia D19 (układ w `localStorage`) i zapis motywu. Ustawienia (od D24 w kolekcji `settings`): `editor.layout` (desktop), `editor.mobileView` (Story / Notes / Chapters), `appearance.theme` (`light` / `dark`, brak = systemowy). Bez strony ustawień: brak pola = wartości domyślne, stary klucz `story-app:editor-layout` jest ignorowany.
- Odczyt: `getUserSettings` (React `cache`, raz na żądanie) + `normalizeSettings` pole po polu; `normalizeLayout` dodatkowo odrzuca szerokości dla nieznanych zestawów kolumn i id paneli. Zapis: `saveSettings(patch)` – tylko przesłane pola (`$set` po ścieżce pola), nieznany motyw / widok → `INVALID_INPUT`, układ normalizowany.
- Układ: serwer renderuje z ustawień (bez mignięcia, bez remontu po hydratacji). Magazyn na poziomie modułu, kluczowany `userId`, żeby przejście do innego rozdziału nie cofało układu, gdy zapis jeszcze trwa. Zapis układu z debounce 500 ms (`LAYOUT_SAVE_DELAY_MS`) i od razu przy ukryciu karty; widok mobilny zapisywany od razu. Zmiana i przeładowanie w ciągu ~0,5 s może zgubić ostatnią zmianę układu.
- Motyw: kopia w przeglądarce w `localStorage` (`theme`) + skrypt w `<head>` – cookie nie wystarczy, bo motyw systemowy i tak wymaga `matchMedia` przed pierwszym malowaniem. Root layout ustawia `data-theme` na `<html>` dla zalogowanego (zapisany motyw albo `system`); skrypt bierze go i aktualizuje kopię w przeglądarce, a bez `data-theme` (logowanie, `/s/...`) używa kopii, inaczej `prefers-color-scheme`. `ThemeToggle` przełącza klasę, `data-theme`, kopię i wywołuje `saveSettings`.

## D24 – Kolekcja `settings` (2026-10-21)

- Zmienia D17 i D23. Ustawienia użytkownika w osobnej kolekcji `settings`, jeden dokument na użytkownika: `userId` (unikalny indeks, `ref: "User"`), grupy `editor` (`layout`, `mobileView`), `appearance` (`theme`), `folders` (`sort`, `manualOrder`), `createdAt`, `updatedAt`. `users` trzyma tylko dane konta.
- Rejestr pól w `lib/settings/settings.ts` (`SETTINGS`): wartość domyślna, walidacja i czy klient może je zapisać. Z niego wynikają typ `UserSettings`, `DEFAULT_SETTINGS`, `normalizeSettings` i `parseSettingsPatch`. Nowe ustawienie = wpis w rejestrze + pole w modelu `Settings`.
- W bazie są tylko wartości wybrane przez użytkownika (bez domyślnych w schemacie), więc zmiana domyślnej dociera do wszystkich. Brak dokumentu = same domyślne.
- Zapis: `updateUserSettings(userId, patch)` – `$set` po ścieżkach (`editor.layout`), upsert, `runValidators`; dwa równoległe pierwsze zapisy (E11000) ponawiane raz. `saveSettings` przyjmuje tylko pola `clientWritable` – `folders.*` zapisuje wyłącznie `setFolderSort`, bo pierwsze przełączenie na manual musi zapisać pozycje. Nieznane pole w patchu → `INVALID_INPUT`.
- Migracja `004-settings` (kopia `users`, `settings`), powtarzalna: przenosi `users.folderSort` / `manualFolderOrder` (oraz `users.settings` z niewydanych buildów taska 09) do `settings` i usuwa je z `users`. Wartość na `users` jest nowsza od tej w `settings` (stary deployment w oknie builda), więc nadpisuje. Rollback do starszej wersji = domyślne sortowanie folderów (ręczne pozycje zostają, ale pierwsze przełączenie na manual nadpisze je widoczną kolejnością).
- `003-positions` nie ustawia już trybu na `users` – inaczej przy każdym deployu dopisywałaby `updated`, a `004` przenosiłaby go do `settings` w miejsce wyboru użytkownika.

## D25 – Wersje folderów (2026-10-21)

- Zmienia spec („Brak historii wersji”). Wersja to stan rozdziałów folderu zapisany ręcznie („Save version” na stronie folderu, wymagana nazwa po `trim()`, maks. 100 znaków). Automatycznie powstaje tylko „Before restoring version N” przed każdym przywróceniem – jak reflog w gicie, więc każde przywrócenie (także usunięcie rozdziałów) da się cofnąć.
- Notatki (rozdziałów i folderu) nie są częścią wersji: nie są zapisywane, porównywane ani przywracane.
- Kolekcja `folderVersions`: `userId`, `folderId`, `number`, `name`, `chapterSort`, `chapters` (`storyId`, `title`, `position` – indeks w kolejności widocznej przy zapisie, `contentId`), `createdAt`; unikalny `{ folderId, number }`. Numer z licznika `folders.versionCounter` (`$inc`), więc nie wraca po usunięciu wersji i nie powtarza się przy równoległych zapisach. Zapis wersji nie zmienia `updatedAt` folderu ani rozdziałów.
- Kolekcja `chapterContents`: jeden dokument na stan rozdziału (`title`, `content`), `_id` = SHA-256 z `[storyId, title, content]`, więc niezmieniony rozdział wskazuje istniejący dokument (upsert). Usunięcie wersji usuwa treści, na które nie wskazuje żadna inna wersja. Wyścig z równoległym zapisem wersji: zapis ustawia `usedAt` po wstawieniu wersji, a sprzątanie pomija treści z `usedAt` nowszym niż jego start.
- Wersja bierze rozdziały z bazy (niezapisane zmiany w otwartym edytorze nie wchodzą).
- Podgląd `/folders/[id]/versions/[n]`: statusy `changed` / `unchanged` / `deleted since` (usunięty albo przeniesiony) / `added since`. Porównanie słowo po słowie od wersji do bieżącego tekstu (`diffWordsWithSpace` z pakietu `diff`), osobno tytuł i treść; przy zbyt wielu zmianach (`maxEditLength` 5000, 500 ms) „Too many changes to compare.”.
- Dwa tryby przywracania, po sukcesie przekierowanie do widoku folderu:
  - „Restore entire version” (jak `git reset --hard`), z potwierdzeniem i podsumowaniem: zmienione rozdziały wracają, usunięte wracają, dodane od tamtej pory są usuwane (soft delete), wraca tryb sortowania, a przy trybie manual także kolejność z wersji.
  - „Restore selected” (jak `git restore --source`): zaznaczone rozdziały z wersji wracają, zaznaczone „added since” są usuwane. Niezmienionych nie da się zaznaczyć. Kolejność i tryb sortowania bez zmian.
- Przywrócony rozdział w folderze dostaje tytuł i treść z wersji z nowym `updatedAt` (otwarty edytor dostaje `CONFLICT`); niezmieniony nie jest zapisywany. Usunięty wraca jako ten sam dokument (`deletedAt: null`, na końcu kolejności ręcznej, bez starego linku udostępniania), więc dalsze porównania go rozpoznają. Przeniesiony do innego folderu jest kopiowany jako nowy rozdział (z bieżącymi notatkami oryginału). Zajęty tytuł → „Tytuł (2)”, „(3)”…; przy zamianie tytułów między dwoma przywracanymi rozdziałami jeden dostanie sufiks.
- Wersje cudzego i usuniętego folderu: `NOT_FOUND` / 404. Eksport i strony publiczne nie pokazują wersji.

## D26 – Lokalny backup bazy (2026-10-28)

- Zmienia zakres taska 16. Skrypt `scripts/backup.sh` (bash + Docker) zamiast `scripts/backup.ts` przez `tsx`: ma działać niezależnie od aplikacji (docelowo także na VPS, automatyzacja później i poza repo). Bash nie mówi protokołem MongoDB, więc `mongodump` działa w kontenerze `mongo:8`; bez Dockera trzeba by instalować MongoDB Database Tools.
- URI z `MONGODB_URI` w `.env.prod` (plik nie jest wczytywany przez `source`, bo URI Atlasa zawiera `&`); brak pliku lub zmiennej → pytanie o URI. Nazwa bazy w URI wymagana, `mongodump` dostaje ją jawnie (`--db`).
- Katalog docelowy poza repo: `/home/$USER/backups/story_app/<czas UTC>/` (UTC, żeby nazwy sortowały się chronologicznie także przy zmianie czasu), więc nic do `.gitignore`. W środku: `<baza>.archive.gz` (pełny backup z indeksami) i `json/<kolekcja>.json` (`mongoexport`, tablica, relaxed Extended JSON) do czytania i odtwarzania pojedynczych kolekcji. Nazwy kolekcji z tymczasowego `mongodump` wewnątrz kontenera, bo `mongosh` przyjmuje URI tylko w argumencie.
- Zostaje 5 najnowszych backupów. Odtwarzanie tylko jako instrukcja w `deploy.md` (bez `npm run restore`).
- Testy uruchamiają skrypt z `ENV_FILE` i `BACKUP_DIR` wskazującymi na katalog tymczasowy i bazy `story_app_test_*`; nigdy `.env.prod`.

## D27 – Pozycja przewijania przy przełączaniu widoków (2026-10-30, zmienione 2026-11-01 w D41)

- Preview ↔ Source: dopasowanie po bloku. `blockStarts` (`lib/editor/source-blocks.ts`) wylicza, gdzie w markdownie zaczyna się każdy węzeł najwyższego poziomu (tokeny lexera `MarkdownManager`, w tym puste akapity z dodatkowych pustych linii, jak w `@tiptap/markdown`). Przy przełączeniu zapamiętywany jest blok przy górnej krawędzi widoku i ułamek jego wysokości; nowy widok przewija się do tego samego miejsca przed odmalowaniem (`useLayoutEffect`). Wysokość linii w textarea (z zawijaniem) mierzy ukryta kopia pola. Widok przewinięty na sam początek zostaje na początku.
- Zakładki Notes / Chapters (desktop, bez Split) i Story / Notes / Chapters (wąski ekran) są zamontowane jednocześnie; nieaktywne mają `visibility: hidden` (nie `display: none`, które może wyzerować przewinięcie). Zostaje więc też tryb Preview/Source i historia Undo. Przy Split i Hide/Show grupa kolumn nadal się remontuje, a pozycję przywraca pamięć opisana niżej.
- Zmiana zakładki nie remontuje grupy kolumn (klucz grupy bez nazwy zakładki), więc edytor treści zostaje nietknięty. Panel boczny zmienia tylko `id` (`notes-column` / `chapters-column`), a biblioteka stosuje wtedy `defaultLayout` – szerokości per zakładka (D19) działają dalej.
- Pamięć pozycji (`lib/editor/scroll-memory.ts`): `localStorage` pod `story-app:scroll`, nie w bazie ani w ustawieniach. Jeden wpis na rozdział (`savedAt`, pozycje pól `content`, `notes`, `folderNotes` jako blok + ułamek oraz `chapters` jako `scrollTop`). Edytor odczytuje pozycję 200 ms po zakończeniu przewijania (pomiar Source kopiuje cały tekst) i przy odmontowaniu (cleanup `useLayoutEffect` widzi jeszcze DOM). Zapis do `localStorage` następuje 300 ms później albo od razu przy ukryciu karty. Kopia w module pozwala przywrócić pozycję przy remoncie przed zapisem. Po otwarciu (zawsze Preview) edytor przewija się do zapamiętanego bloku. Zostaje 50 ostatnio zapisanych rozdziałów, wpisy starsze niż 30 dni są pomijane. Każdy dostęp do `localStorage` jest w `try/catch`, błędne wpisy są odrzucane pole po polu. Notatki folderu na stronie folderu nie są pamiętane.

## D28 – Myślniki dialogowe (2026-10-30)

- Zmienia D20 (`- ` nie tworzy już listy). Dialog zapisujemy w źródle z półpauzą: `– Tekst` to zwykły akapit, więc podgląd, strony publiczne i eksport działają bez specjalnego renderowania.
- `DialogueDash` (`lib/editor/dialogue.ts`): wpisanie `- ` na początku bloku daje `– `. Reguła ma wyższy priorytet niż reguła listy ze StarterKit. W komentarzu nie działa (`code: true`).
- `DialogueParagraph`: serializer zamienia `- ` na początku linii akapitu na `– `, bo taki tekst (wklejenie, cofnięcie reguły, linia po Shift+Enter) wróciłby z markdownu jako lista. W edytorze myślnik zostaje do ponownego wczytania.
- Listy punktowane zostają: przycisk i `* ` (także `+ `). Serializer dalej zapisuje je jako `- `, a `- ` wpisane w Source to lista.
- Bez migracji: istniejące linie `- ` zostają listą, użytkownik poprawi je ręcznie (jak w D20). Zmienia kryterium 4 taska 13.

## D29 – Menu konta zamiast górnego paska (2026-10-30)

- Górny pasek `h-14` usunięty ze wszystkich stron chronionych. Stories, Toggle theme i Log out są w menu konta (`app/(protected)/account-menu.tsx`, przycisk „Account”) renderowanym w layoucie, więc działa na każdej stronie chronionej, także na 404.
- Przycisk jest `absolute` w prawym górnym rogu: odjeżdża z przewijaną stroną i nie zasłania treści. Mieści się w górnym paddingu stron (32 px), a w edytorze wiersz tytułu rezerwuje na niego miejsce. Edytor ma wysokość `h-dvh`.
- Ikona „Home” (`/stories`) w lewym górnym rogu, w layoucie i pozycjonowana tak samo jak przycisk menu. Wiersz tytułu edytora ma miejsce po obu stronach (`px-9`). Pozycja Stories w menu zostaje.
- `components/ui/dropdown-menu.tsx`: Radix z istniejącego pakietu `radix-ui`, bez nowej zależności. `ThemeToggle` zastąpiony pozycją menu; `applyTheme` wywołuje `AccountMenu`, bo treść menu jest montowana dopiero po otwarciu.

## D30 – Przewijanie poza tekst (2026-10-30)

- Dotyczy każdego `MarkdownEditor`: treści, notatek rozdziału i notatek folderu. Odstęp nad pierwszą linią to połowa, a pod ostatnią trzy czwarte wysokości widoku minus jedna linia (`--scroll-gap-top`, `--scroll-gap-bottom`, liczone w `trackScrollGap`, `ResizeObserver` na elemencie przewijanym; zmniejszone 2026-11-03 na prośbę użytkownika z pełnej wysokości). Wysokość linii pochodzi z pola, więc dłuższy nagłówek jako ostatnia linia jest przy maksymalnym przewinięciu widoczny częściowo.
- Po otwarciu `scrollTop` to 0, czyli pierwsza linia stoi w połowie widoku. To decyzja użytkownika, tak samo nad tekstem w notatkach i przy zapamiętanej pozycji „na początku” (D27).
- Element nie może być niższy niż jego padding, więc textarea w Source nie przewija się sama: rośnie z tekstem (`field-sizing: content`), a przewija ją zewnętrzny element, jak w Preview. Kliknięcie w pusty obszar ustawia fokus w polu. `field-sizing` nie ma fallbacku, Source wymaga przeglądarki, która go obsługuje (testy: Chromium).
- Pozycja nad pierwszą linią nie jest kotwicą: przełączenie Preview/Source z tego obszaru (`scrollTop` > 0) ustawia pierwszą linię przy górnej krawędzi.

## D31 – Eksport do nowych formatów w przeglądarce (2026-10-30)

- Formaty: `.docx`, `.odt`, `.pdf`, `.epub`, `.fb2`, `.html`, `.txt`, `.md` (jeden plik). Dotyczą rozdziału i folderu; folder to jeden dokument z rozdziałami w kolejności folderu. „Export .md” (D10) i „Export .zip” (D18) zostają bez zmian jako pełny backup.
- Limit 4,5 MB obejmuje na Vercelu też odpowiedzi, na każdym planie. Dlatego `GET /stories/[id]/export/data` i `/folders/[id]/export/data` zwracają tylko tekst w JSON, a plik buduje przeglądarka. Limit dotyczy samego tekstu. Generatory są ładowane przez `import()` po kliknięciu, więc nie powiększają stron.
- Model: `parseBlocks` (`lib/export/blocks.ts`, lexer `marked` z `breaks` i `gfm`, jak D20) daje wspólne bloki dla rendererów w `lib/export/formats/`. Surowy HTML jest pomijany (D8, D20), linki tylko `http:`, `https:`, `mailto:`. Nagłówki `h4`–`h6` ze Source spadają do poziomu 3. `.md` to surowe źródło, więc zawiera też surowy HTML, jak D10.
- Dialog „Export as…”: przełącznik „Include comments and notes”, domyślnie wyłączony. Włączony dodaje komentarze w nawiasach kwadratowych kursywą, notatki rozdziału pod jego tekstem i notatki folderu na końcu.
- `.epub` i `.odt` bez pakietu: ręczne XML + `fflate`. `.docx` przez `docx`, `.pdf` przez `pdfkit` (build przeglądarkowy wybierany przez `exports`). Typy `pdfkit` we własnym `types/pdfkit.d.ts`. PDF osadza DejaVu Serif z `public/fonts/` (polskie znaki, licencja obok plików); znaki spoza fontu, np. emoji, nie zostaną poprawnie narysowane.
- Rozdział: „Export as…” przed pobraniem danych zapisuje przez tę samą kolejkę co „Export .md” (D10).

## D32 – Zip z osobnym plikiem na rozdział (2026-10-30)

- Uzupełnia D31. W dialogu „Export as…” na stronie folderu przełącznik „One file per chapter (.zip)” działa dla każdego formatu. Plik `<nazwa folderu>.zip` budowany w przeglądarce (`buildChapterFilesZip`), rozdziały nazwane jak w D18 (`NN-<nazwa>.<rozszerzenie>`).
- Każdy rozdział to osobny dokument z tytułem rozdziału, także przy `.epub`, `.fb2`, `.pdf`. Przełącznik „Include comments and notes” działa jak w D31, a notatki folderu trafiają do `notes.<rozszerzenie>`.
- „Export .zip” (D18) zostaje bez zmian: tylko on daje `.md` z frontmatterem i zawsze zawiera notatki.

## D33 – Tylko przycisk „Export as…” (2026-10-30)

- Decyzja użytkownika: z UI znikają przyciski „Export .md” i „Export .zip”. W edytorze i na stronie folderu zostaje „Export as…” (D31, D32). Zmiana dotyczy wyłącznie przycisków.
- Wszystkie formaty zostają. Trasy `GET /stories/[id]/export` i `GET /folders/[id]/export` (D10, D18) oraz frontmatter działają bez zmian, ale UI do nich nie prowadzi.
- Zapis przed eksportem, konflikt z inną kartą i pusty tytuł sprawdzają testy dialogu.

## D34 – Import opowiadań (2026-10-30)

- Formaty jak w D31 oraz `.zip` (D18, D32), plik do 50 MB. Parsowanie w przeglądarce (`lib/import/`, ładowane przez `import()`), Server Action `importStories` dostaje tylko tekst. `serverActions.bodySizeLimit` to 4 MB, tekst do 3,5 MB w bajtach (reszta na kodowanie żądania). Akcja waliduje wszystko sama, także przed utworzeniem folderu. Większy tekst trzeba podzielić ręcznie.
- Wszystkie formaty z nagłówkami przechodzą przez markdown (`structureMarkdown`). Pojedyncze `# ` na początku to tytuł, rozdziały to `## `, a bez tytułu i z kilkoma `# ` rozdziały to `# `. Folderu z rozdziałami nie da się pewnie odróżnić od opowiadania z nagłówkami, więc dialog pokazuje listę i przełącznik „Split into N chapters”, domyślnie włączony. `.epub`, `.fb2` i `.zip` mają rozdziały w strukturze, `.pdf` to zawsze jeden rozdział.
- `.md` z eksportu z własnym `# ` w tekście wygląda jak kilka rozdziałów, trzeba wyłączyć przełącznik. W `.zip` plik to zawsze jeden rozdział.
- Decyzja użytkownika: ostatni nagłówek „Notes” rozdziału i końcowa sekcja „Folder notes” wracają do notatek, więc taki sam własny nagłówek też tam trafi. Komentarze zostają w tekście jako `[tekst]` kursywą. `.md` z frontmatterem odzyskuje tytuł i notatki.
- Daty: zawsze data importu, także z frontmatterem. Kolejne rozdziały różnią się o 1 ms, żeby „Newest first” było powtarzalne.
- Nowy folder ma tryb manual z kolejnością z pliku. Na `/stories` jeden rozdział idzie do wybranego folderu (nowa nazwa go tworzy), więcej rozdziałów do nowego folderu. Na stronie folderu do tego folderu, a notatki z pliku są dopisywane pod istniejącymi.
- Sufiksy jak D25 (`numberedTitle`), także w obrębie pliku. Tytuł z równoległego zapisu daje `DUPLICATE_TITLE`, a wstawione rozdziały są usuwane.
- Treść przez `turndown`: pojedynczy Enter to `\n` (D20), `\- ` na początku linii to `– ` (D28), obrazki są pomijane. `.txt` traktujemy jak markdown, pierwsza krótka linia z pustą linią pod spodem to tytuł. `.pdf`: akapity z odstępu między liniami, bez formatowania, nagłówków i pojedynczych Enterów, stąd ostrzeżenie. `.fb2` nie ma pojedynczego Entera, więc takie linie wracają jako akapity. Cytaty z `.docx` wracają jako zwykłe akapity.
- `unpdf` w wersji 2.x wymaga Node 24: taką wersję ma Vercel i domyślny nvm.

## D35 – Wyszukiwanie i zamiana w polu (2026-10-30)

- Zmienia D20 (skróty). Ctrl/Cmd+F otwiera panel Find, Ctrl/Cmd+H także wiersz zamiany, tylko gdy fokus jest w tym `MarkdownEditor` (pole, jego pasek, panel). Poza nim zostają skróty przeglądarki. Przycisk „Find and replace” w pasku działa w obu trybach, także na wąskim ekranie. Zaznaczony tekst (jedna linia) staje się zapytaniem. Enter: następne, Shift+Enter: poprzednie, Esc: zamyka i zaznacza bieżące trafienie w polu. Cmd+H na macOS przechwytuje system.
- Opcje: Match case (domyślnie bez rozróżniania), Whole word, Regular expression (`$1` w zamianie, także `^`/`$` na linię). Whole word liczy granice po literach Unicode, bo `\\b` nie zna polskich znaków. Bez trybu regex `$` w zamianie jest zwykłym znakiem. Puste dopasowania (`a*`) są pomijane.
- Preview szuka w tekście widocznym, osobno w każdym bloku (bez znaczników markdown, także w komentarzach), dekoracjami ProseMirror (`lib/editor/find-highlight.ts`). Złamanie linii to `\n`, trafienie nie przechodzi między blokami. Zamiana przejmuje formatowanie pierwszego zastąpionego znaku. Source szuka w surowym markdownie, więc liczba trafień może się różnić między trybami. Textarea nie stylizuje fragmentów, więc pod nią leży kopia tekstu z niewidocznymi literami i `<mark>`.
- Undo: „Replace” i „Replace all” to jeden krok, także zaraz po pisaniu (`closeHistory` w Preview). W Source zamiana idzie przez `document.execCommand`, który jako jedyny zachowuje natywne Undo textarea, a „Replace all” podmienia cały tekst jednym poleceniem. Metoda jest przestarzała, ale nie ma zamiennika.
- Po zamianie bieżącym trafieniem jest następne za nowym tekstem, więc „kot” → „kotek” nie trafia ponownie w to samo miejsce. Fokus wraca do pola Find, bo przyciski stają się nieaktywne, gdy nie ma trafień. Zmiana idzie zwykłą ścieżką edycji, więc autozapis działa bez zmian (D22).

## D36 – Tagi (2026-11-01)

- Zmienia spec („bez tagów”). Pole `tags` (tablica stringów) na `folders` i `stories`, tagi osobno na każdym poziomie. Kod odczytu traktuje brak pola jak pustą listę, a powtarzalna migracja `005-tags` uzupełnia dokumenty tworzone przez starą wersję w trakcie builda.
- Normalizacja: `trim`, zwinięcie białych znaków do jednej spacji, małe litery, bez duplikatów, puste odrzucane. Spacje w środku tagu i polskie znaki zostają. W dialogu przecinek rozdziela tagi. Limity: 30 znaków na tag, 10 tagów na folder lub rozdział; przekroczenie → `INVALID_INPUT`, wejście spoza tablicy stringów też.
- Rozdział dziedziczy tagi folderu i wliczają się one do jego limitu: suma tagów własnych i odziedziczonych to maks. 10, a tag obecny na obu poziomach liczy się raz. Zapis tagów folderu, który przekroczyłby limit któregoś aktywnego rozdziału, jest odrzucany z nazwą tego rozdziału. Przeniesienie rozdziału przekraczające limit też jest odrzucane. Przywracanie wersji nigdy nie jest odrzucane z tego powodu, a rozdział ponad limitem trzeba zmniejszyć przy kolejnej edycji jego tagów.
- Tagi to zmiana organizacyjna: akcje `setFolderTags` i `setStoryTags` zastępują całą listę i nie zmieniają `updatedAt`, `lastActivityAt` ani `notesUpdatedAt`, więc otwarty edytor nie dostaje `CONFLICT`. Tagów nie ma w eksporcie, wersjach folderów i na stronach publicznych. Przywrócenie wersji ich nie zmienia; rozdział przeniesiony i kopiowany przy przywracaniu dostaje bieżące tagi oryginału, jak notatki.
- Podpowiedzi i filtr biorą własne tagi użytkownika z aktywnych folderów i rozdziałów.
- Filtr na `/stories`: parametry `?tag=a&tag=b`, wartości normalizowane jak przy zapisie. Wybrany tag zmienia widok folderów na listę rozdziałów, ten sam co wyniki wyszukiwania. Kilka tagów działa jak AND, a rozdział dziedziczy tagi folderu, więc każdy tag może pasować przez rozdział albo przez jego folder. Przeniesienie rozdziału zmienia odziedziczone tagi. Pusty folder z tagiem nie pojawia się w wynikach.
- Wybór tagów to klikalne chipy (linki zachowujące `q`), a formularz wyszukiwania zachowuje wybrane tagi w ukrytych polach.
- Edycja w dialogu „Tags”: folder na swojej stronie, rozdział w wierszu listy rozdziałów, nie w edytorze. Listy folderów, rozdziałów i wyników pokazują tagi elementu, a przy rozdziałach także odziedziczone, w odróżnionym stylu. Dialog rozdziału pokazuje odziedziczone bez przycisku usuwania, usuwa się je na folderze.

## D37 – Logowanie przez nick, bez migracji danych (2026-11-01)

- Zmienia D1 i D4. Konto to `nickname` i hasło, komunikat błędu: „Invalid nickname or password.”. Bez fallbacku na e-mail w formularzu.
- `email` usunięty ze schematu `User`, ale zostaje w dokumentach (decyzja użytkownika): pliku migracji nie ma, a nicki istniejącym kontom właściciel ustawia ręcznie przed wydaniem (`deploy.md`). `syncIndexes()` w buildzie sam usuwa `email_1`, więc nowe konta nie kolidują na braku e-maila.
- Nick: jedno pole `nickname` z unikalnym indeksem z collation `{ locale: "en", strength: 2 }`, żeby ręczna zmiana w bazie dotyczyła jednego pola. Zapytania o nick muszą podawać tę collation. Indeks częściowy (`$type: "string"`), żeby konta jeszcze bez nicku nie wywracały builda kolizją na `null`.
- Nick: 3–30 znaków, `A-Za-z0-9_-`. Hasło: 17–256 znaków (punktów kodowych), mała i wielka litera (także Unicode), cyfra, znak specjalny ASCII. Walidacja w `lib/credentials.ts`, egzekwowana też w `createOrUpdateUser`. Istniejące hasła nie są sprawdzane.
- bcrypt uwzględnia tylko 72 bajty, więc nowe hasła idą przez SHA-256 (hex), a hash ma prefiks `sha256$`. Hash bez prefiksu to bcrypt surowego hasła sprzed D37 i działa dalej. Bez nowych pakietów.

## D38 – Publikacja zamiast udostępniania linkiem (2026-11-01, zmienione 2026-11-04 w D54)

- Zmienia D1, D11, D18, D25 i spec („Udostępnianie przez link”). Decyzja użytkownika: „Share” znika całkowicie. Usunięte trasy `/s/...`, akcje `setSharing` i `setFolderSharing`, nagłówki `X-Robots-Tag`, przyciski. Wysłane linki przestają działać i nie są przenoszone do publikacji. `shareToken` zostaje w dokumentach (D14, expand-only), usuwamy go ze schematu, a `syncIndexes()` w buildzie usuwa indeksy.
- Bez pliku migracji: brak `published` to nieopublikowany folder, brak `publication` to brak decyzji, więc po wdrożeniu nic nie jest publiczne.
- W UI zawsze „Publish” / „Unpublish”, także przy rozdziale; wartość `hidden` to tylko nazwa w bazie.
- Stan: `folders.published` oraz `stories.publication` (`public`, `hidden`, brak). Rozdział jest publiczny tylko, gdy folder jest aktywny i `published`, a rozdział aktywny i `public`.
- „Publish” folderu: `published`, rozdziały bez decyzji stają się `public`, jawne stany zostają. „Unpublish” zachowuje stany rozdziałów, więc ponowny „Publish” przywraca ten sam zestaw. „Publish all” (z potwierdzeniem, tylko w opublikowanym folderze) ustawia wszystkie aktywne na `public`.
- „Publish” rozdziału to publikacja folderu z pozostałymi wyłączonymi: w nieopublikowanym folderze rozdział dostaje `public`, a wszystkie pozostałe `hidden`, także te publiczne przed „Unpublish” (zgłoszenie użytkownika: nie mogą wracać razem z jednym rozdziałem). W opublikowanym folderze zmienia się tylko ten rozdział. „Unpublish” rozdziału ustawia `hidden`.
- Nowy, zaimportowany, przeniesiony lub przywrócony rozdział: `hidden` w opublikowanym folderze, inaczej brak decyzji. Przeniesienie kasuje też stare adresy.
- Folder bez żadnego publicznego rozdziału daje czytelnikowi 404.
- Kolejność czytania: przy „Newest first” strony publiczne odwracają kolejność (najstarszy rozdział jako 1., także poprzedni / następny). „Manual” i „A–Z” zostają jak u autora.
- Adres: `/p/<nick>/<folder>` (spis) i `/p/<nick>/<folder>/<rozdział>`, także dla pojedynczego rozdziału. Slugi z `safeFileName`, liczone przy odczycie, bez unikalnego indeksu, bo każdy `E11000` w zapisach znaczy dziś „tytuł zajęty”. Kolizję (np. „Ą” i „A”) rozstrzyga `_id`: starszy dostaje czysty slug, nowszy `-2`. Ukryte rozdziały i prywatne foldery też się liczą, więc ukrycie nie zmienia adresu sąsiada, ale sufiks `-2` zdradza istnienie podobnie nazwanego prywatnego folderu. Adres zależy od sąsiadów: usunięcie lub zmiana nazwy starszego z dwóch kolidujących przesuwa adres młodszego bez przekierowania, a zmiana nazwy może przejąć cudzy dotychczasowy adres. Kolizje wymagają nazw różniących się tylko wielkością liter, znakami diakrytycznymi lub interpunkcją, więc to przypadek rzadki i zaakceptowany.
- Zmiana tytułu lub nazwy zmienia adres, a stary trafia do `formerSlugs` i przekierowuje (307, bo slug może wrócić do użycia, a 308 przeglądarka zapamiętuje na stałe), tylko dla publicznego rozdziału lub opublikowanego folderu. Aktualny slug ma pierwszeństwo nad `formerSlugs`. Nick w złej wielkości liter też przekierowuje.
- Strony są indeksowane (decyzja użytkownika): bez `noindex`, tytuł strony to „<tytuł> by <nick>”. Bez sitemap. Treść na żywo, jak w dawnym „Share”, więc autozapis po 20 s jest od razu publiczny (`connection()`, bez cache).
- Publikacja to zmiana organizacyjna: `timestamps: false`, bez zmian `lastActivityAt` i `notesUpdatedAt`. Eksportu i wersji folderów nie dotyczy, przywrócenie wersji nie zmienia `publication` rozdziału, który został w folderze.
- UI: „Publish” / „Unpublish” i link na stronie folderu i w edytorze, przycisk ikony przy każdym rozdziale na liście.

## D39 – Zmiana hasła, bez zmiany nicku (2026-11-01)

- Zmienia zakres taska 41 (decyzja użytkownika): nicku nie można zmienić, także z migracji. Adresy `/p/<nick>/...` są więc stałe i nie ma `formerNicknames`. Nick poprawia tylko właściciel ręcznie w bazie (D37).
- „Change password” w menu konta (D29) otwiera dialog, bez strony ustawień. Dialog jest renderowany obok `DropdownMenu`, bo menu odmontowuje treść po zamknięciu.
- Akcja `changePassword` przyjmuje stare hasło, nowe i powtórzenie. Konto bierze z sesji. Błędny typ, różne hasła, słabe nowe i złe stare dają `INVALID_INPUT`. Nowe może być równe staremu, o ile spełnia wymagania.
- Wymagania są wypisane przy polu nowego hasła (`PASSWORD_REQUIREMENTS` w `lib/credentials.ts`, `aria-describedby`), a test pilnuje zgodności listy znaków specjalnych z `passwordError`.
- Zmiana hasła nie unieważnia sesji (JWT nie ma do tego mechanizmu), więc inne urządzenia zostają zalogowane do wygaśnięcia sesji. Bez opóźnienia `LOGIN_DELAY_MS`: zgadywać starego hasła może tylko ktoś z ważną sesją.

## D40 – Rejestracja i limit prób (2026-11-01)

- Zmienia D1 („brak rejestracji w UI”) i D4. Publiczna strona `/register`: nick, hasło, powtórzenie. Skrypt `create-account` zostaje.
- Rejestracja używa `createUser` (tylko `insert`), nigdy `createOrUpdateUser`, bo upsert zmieniłby hasło istniejącego konta. Zajęty nick i wyścig rozstrzyga unikalny indeks (D37), wcześniejszy odczyt daje ten sam komunikat bez liczenia hasha.
- Limit (mechanizm także dla taska 39): kolekcja `rateLimits`, dokument na regułę, klienta i okno: `_id` = `<reguła>:<HMAC-SHA256 z IP, klucz AUTH_SECRET>:<początek okna>`, `count`, `expiresAt`. Stałe okno, licznik resetuje się razem z oknem, a poprawność nie zależy od TTL, który tylko sprząta. IP w bazie nie jest zapisywane jawnie. Bez pliku migracji: indeks TTL tworzy `syncIndexes()` w buildzie (D14).
- `takeAttempt` najpierw zwiększa licznik, potem sprawdza, więc równoległe żądania nie przejdą limitu. `giveBackAttempt` oddaje próbę, która nie powinna się liczyć.
- Rejestracja: 5 kont na godzinę z IP. Liczą się tylko utworzone konta (decyzja użytkownika), więc literówki i zajęte nicki nie blokują, a sprawdzanie zajętości nicków nie ma limitu (odrzucany przed bcrypt, więc tani).
- Logowanie: 20 nieudanych prób na 15 minut z IP, sprawdzane w `authorizeCredentials`, bo `/api/auth/callback/credentials` da się wywołać z pominięciem akcji `login`. Po przekroczeniu nawet poprawne hasło daje „Too many attempts…” (`LoginRateLimited`). Udane logowanie oddaje próbę.
- IP: pierwszy adres z `x-forwarded-for`, który Vercel ustawia sam. Bez nagłówka wszyscy dzielą klucz `unknown`. IPv6 liczone po sieci /64, bo pojedynczy klient zwykle ma całą taką sieć. Współdzielony adres (NAT, akademik) dzieli limit.
- Gdy automatyczne logowanie po rejestracji trafi na limit logowania, konto już istnieje, więc akcja przekierowuje na `/login`.
- Vitest: `next-auth` w `server.deps.inline`, bo pakiet importuje `next/server` bez rozszerzenia, a `authorize.ts` i akcje używają jego klas błędów w testach.

## D41 – Zakładka Tools (2026-11-01)

- Zmienia D12, D19 i D27. Trzeci panel boczny `tools`: zakładka, kolumna w Split, czwarty widok na wąskim ekranie (`editor.mobileView`). Zamontowany razem z innymi widokami (D27).
- Zakładka to tylko siatka kafelków z rejestru `TOOLS` (`app/(protected)/stories/[id]/tools.tsx`). Kafelek otwiera narzędzie w dialogu. Otwarte narzędzie trzyma `Editor`, a `ToolDialog` jest renderowany poza drzewami układu, więc zmiana szerokości okna go nie zamyka. Zmiana rozdziału i przeładowanie je zamykają. Name generator, Synonyms i Rhymes to atrapy („Coming soon.”) do tasków 42, 33 i 34.
- Bez Split wszystkie zakładki mają jedną szerokość: stałe id panelu `side-column` i klucz `story,side`. Zmiana zakładki nie zmienia już szerokości, co odwraca „szerokości per zakładka” z D27. `normalizeLayout` przenosi na ten klucz szerokość wybranej zakładki, a gdy jej nie ma, pierwszej zapisanej. Split ma nadal szerokości per zestaw kolumn.
- `normalizeLayout` uzupełnia `order` o brakujące panele zamiast go odrzucać. Zapisany układ ze Split bez `tools` dostaje `collapsed.tools = true`, bo trzecia widoczna kolumna zmieniłaby klucz szerokości i wyzerowała układ. Przycisk „Show tools” stoi przy prawej krawędzi.
- Przy trzech kolumnach bocznych domyślna szerokość to 20%, żeby Story nie spadło poniżej `minSize` 30%. `moveColumn` przeskakuje schowane kolumny, inaczej Move left/right bywałby bez widocznego efektu.

## D42 – Publiczna wyszukiwarka, strona główna i sidebar (2026-11-01, zmienione 2026-11-04 w D54)

- Zmienia D1, D4, D29, D36, D38 i D40. Strona `/` to publiczna wyszukiwarka i widok domyślny po zalogowaniu (logowanie, rejestracja i Home prowadzą na `/`). Zalogowany widzi tę samą stronę z sidebarem.
- Treść: regex bez rozróżniania wielkości liter, jak na `/stories`. `$text` nie zna polskiego, Atlas Search wymagałby innego obrazu Dockera i indeksu poza `syncIndexes()`, a embeddingi wysyłają tekst do dostawcy i kosztują. Regex nie zna odmiany („ręka” nie znajdzie „ręce”), nie widzi tekstu rozdzielonego znacznikami (`**a** b` dla „a b”) i przegląda wszystkie publiczne rozdziały. Przy dużej liczbie tekstów trzeba wrócić do Atlas Search.
- `content` zawiera komentarze, więc zapytanie do bazy tylko zawęża kandydatów, a `matchesPublicText` sprawdza tekst po `stripComments`. Fragment też powstaje z tego tekstu. Tekst złączony po usunięciu komentarza może dać trafienie, którego czytelnik widzi jako jedno miejsce. Notatek nie ma w `select`.
- Pole tekstowe szuka w tytule rozdziału, nazwie folderu (tytuł książki; pasują wszystkie jego publiczne rozdziały), treści i tagach (cały tag po normalizacji). Kliknięte tagi (`?tag=`) są obowiązkowe (AND, jak D36), a tag folderu jest dziedziczony. Lista tagów bierze tylko publiczne rozdziały i ich foldery. Tag z wejścia to najwyżej `MAX_TAGS`, zapytanie to najwyżej 100 znaków.
- Wyniki: do 50 (po sprawdzeniu komentarzy), od ostatnio zmienionych. Adresy z tych samych slugów co strony czytania, więc liczą się też ukryte rozdziały i prywatne foldery. Autorzy bez nicku (D37) są pomijani, bo nie mają publicznego adresu.
- Limit: 30 wyszukiwań na minutę z IP (`SEARCH_LIMIT`, D40). Pusta strona nie zużywa limitu, a generowanie metadanych go nie liczy. Linki tagów mają `prefetch={false}`, żeby prefetch nie zużywał prób.
- Strona jest indeksowana (decyzja użytkownika), także adresy z `?q=`, więc roboty mogą zużywać limit swojego adresu. Bez sitemap.
- `/login` i `/register` usunięte (decyzja użytkownika), adresy dają 404 i są na liście publicznych, żeby nie otwierać dialogu, który po zalogowaniu wróciłby na 404. Dialog na `/` przełącza logowanie i rejestrację. Otwiera go przycisk, `?auth=login` albo `callbackUrl` z proxy (`pages.signIn: "/"`). Akcje i formularze w `app/auth/`.
- Sidebar (`components/app-sidebar.tsx`) zastępuje menu konta i ikonę Home z D29, na każdej stronie zalogowanego, także w edytorze. Pozycje: Home, Search, Folders, Toggle theme, Change password, Log out. Na desktopie zwijany do paska ikon (`appearance.sidebarCollapsed`, D24), poniżej `md` wysuwana szuflada otwierana przyciskiem „Menu”.

## D43 – Generator nazw (2026-11-02)

- Generator działa w całości w przeglądarce, bez AI i bez modeli uczonych na danych (decyzja użytkownika). Dlatego sylaby z tabel głosek i morfemy zamiast łańcucha Markowa, który wymagałby list nazw i trudniej reagowałby na filtry. Szczegóły: `docs/tasks/42-name-generator.md`.
- Nazwy znaczące: styl Polish/Slavic składa je z polskich członów, pozostałe style z angielskich albo wymyślonych. Mix styles dotyczy tylko sylab, nie takich członów.
- Lista 10 nazw jest zastępowana przy „Next 10”, a powtórki są wykluczane do zamknięcia dialogu. Wyniki nie są zapisywane; można je tylko skopiować.
- Sprzeczne filtry są blokowane (decyzja użytkownika): wybranie jednego odznacza ten, który przeszkadza, według osobnej listy par. Wartość, której kliknięcie coś odznaczy, ma przerywaną ramkę. Komunikat o braku wyników zostaje dla pól tekstowych i kombinacji trzech i więcej filtrów, których lista par nie obejmuje.
- Filtry w `localStorage` wygasają 7 dni po ostatniej zmianie (decyzja użytkownika).
- Ustalone przy implementacji: Polish letters jest domyślnie włączony (nazwy polskie mają diakrytyki), a Apostrophes and hyphens działa dwustronnie: włączony wymaga znaku w każdej nazwie, wyłączony go zabrania. Unpronounceable i Balanced to dodatkowa sprzeczność, bo mutacja usuwająca samogłoskę nie mieści się w 36–54% samogłosek.
- Rdzenie wulgarne obejmują polski, angielski i rosyjski (rosyjski w transliteracji łacińskiej, bo generator nie tworzy cyrylicy). Są w bundlu klienta, ładowane z generatorem dopiero po otwarciu kafelka.

## D44 – Język folderu w tasku LanguageTool (2026-11-02)

- Decyzja użytkownika: task 31 nie istnieje osobno, jego zakres jest częścią taska 29. Do tego czasu zostaje D21. Numer 31 nie wraca.
- Na razie tylko polski, bez angielskiego. Dzisiejszy `lang="pl"` i spellcheck przeglądarki już to obsługują, a sam język folderu przydaje się dopiero z parametrem `language` LanguageTool.
- Pisownia na bieżąco zostaje w przeglądarce (`lang` z folderu), bez słowników w aplikacji i nowych pakietów.
- Język dotyczy edytora i LT. Kafelki słownikowe pokazują się bez warunku, a eksport i strony publiczne zostają bez zmian.
- Taski 23, 32, 33 i 34 nie zależą już od języka folderu.

## D45 – Claude nie merguje do `staging` i `main` (2026-11-02)

- Zmienia D15. Decyzja użytkownika po merge'u `develop` → `staging`, o który nie poprosił wprost: merge do `staging` i `main` oraz push na te branche robi wyłącznie użytkownik, także gdy prosi o testy na stagingu. Claude pushuje tylko `develop` (na prośbę) i otwiera PR-y wydań.
- Egzekwuje to hook PreToolUse `.claude/hooks/protect-branches.sh`: blokuje `git merge` na tych branchach, `git push` na nie i wszystkie `gh pr merge` (każdy PR w tym repo celuje w `staging` albo `main`).
- `resolve-pr-conflicts` pomija PR-y z headem `staging` lub `main` i podaje komendy użytkownikowi.

## D46 – Wielojęzyczny interfejs z prefiksem w adresie (2026-11-03, zmienione 2026-11-04 w D54)

- Zmienia zasadę „UI w całości po angielsku” i założenie prywatnej aplikacji: aplikacja docelowo jest publiczna, interfejs ma wybór języka. Na start angielski i polski; kolejny język to tylko nowy plik tłumaczeń i wpis na liście języków (decyzja użytkownika).
- Biblioteka `next-intl` (decyzja użytkownika, instalacja w tasku 43).
- Każdy adres ma prefiks `/en/...` albo `/pl/...`, także dla domyślnego angielskiego. Segmenty ścieżek są te same we wszystkich językach (`/pl/stories`). Poza prefiksem zostają Route Handlery (`/api/...`, eksport).
- Wejście bez prefiksu przekierowuje na język wybrany kolejno z: ustawienia zalogowanego użytkownika, cookie z ostatniego wyboru, `Accept-Language`, a gdy nic nie pasuje – angielski. Stare adresy (w tym publiczne `/p/...`) działają dzięki temu przekierowaniu.
- Przełącznik tylko w sidebarze (zalogowani). Niezalogowany zmienia język adresem albo ustawieniami przeglądarki.
- Komunikaty Server Actions tłumaczone na serwerze według języka żądania; kształt `{ ok, error, message }` bez zmian.
- Język interfejsu jest niezależny od języka treści folderu (D44, task 29): `lang` edytora i spellcheck zależą od folderu, nie od UI.
- Polskie tłumaczenie przygotowuje Claude, użytkownik je przegląda.
- Podział: task 43 (routing), 44 (słowniki `en`), 45 (przełącznik i `pl`).

## D47 – Publiczny link bez prefiksu języka (2026-11-03)

- Link publiczny pokazywany i kopiowany w edytorze i folderze (`Public link`) zostaje bez prefiksu (`/p/nick/folder`): odbiorca trafia na swój język przez przekierowanie z proxy (D46), a nie na język autora (decyzja użytkownika).
- Linki klikane w aplikacji (wyszukiwarka, nawigacja rozdziałów) idą przez helpery `next-intl` i mają prefiks bieżącego języka.
- Route Handlery eksportu leżą w `app/stories/[id]/export` i `app/folders/[id]/export`, poza `app/[locale]`, pod tymi samymi adresami co wcześniej.

## D48 – Słownik i komunikaty generowane (2026-11-03)

- Jeden plik `messages/en.json` z przestrzeniami nazw według obszaru; typy kluczy z `en` (`types/next-intl.d.ts`), więc brakujący klucz w innym języku to błąd `tsc` (decyzja użytkownika).
- Walidacja w `lib/` nie zależy od `next-intl`: zwraca klucz i wartości (`ValidationError`, `ErrorMessage`), a Server Action tłumaczy je na serwerze (`translateError` / `actionError` z `lib/i18n/action-error.ts`). Klient tłumaczy klucze sam (wymagania hasła, błędy importu `ImportError.key`). Poza żądaniem (skrypt `create-account`, rzucane błędy) tekst jest po angielsku przez `inEnglish` (decyzja użytkownika).
- Teksty generowane do treści (tytuł „Chapter N” przy imporcie, nagłówki „Notes” i „Folder notes” w eksporcie, nazwa wersji „Before restoring version N”) są w języku interfejsu w chwili utworzenia; zapisane dane się nie zmieniają (decyzja użytkownika).
- Import rozpoznaje nagłówki „Notes” i „Folder notes” wszystkich języków z listy `DOCUMENTS` w `lib/i18n/english.ts`. Nowy język trzeba tam dopisać (poza plikiem `messages/xx.json` i listą języków w `i18n/routing.ts`).
- Strona 404 poza prefiksem języka (`app/not-found.tsx`) zostaje po angielsku: nie ma z czego wziąć języka.

## D49 – Przełącznik języka i język po zalogowaniu (2026-11-03)

- Przełącznik „Language” w sidebarze to menu z listą języków, każdy nazwany we własnym języku (`LOCALE_NAMES` w `i18n/routing.ts`; decyzja użytkownika).
- Ustawienie `appearance.locale` zapisuje tylko akcja `changeLocale`, która ustawia też cookie `NEXT_LOCALE` na rok; `saveSettings` go nie przyjmuje. `null` = nie wybrano, język z cookie albo `Accept-Language`.
- Logowanie woła `signIn` z `redirect: false` i przekierowuje samo: na `callbackUrl` w języku z ustawienia (i ustawia cookie), a bez ustawienia w języku bieżącej strony. Auth.js nie sprawdza już `callbackUrl`, więc przed otwartym przekierowaniem chroni `withLocale`, które zostawia tylko ścieżkę i query.
- Ograniczenie: proxy nie czyta bazy. Na urządzeniu, które już jest zalogowane, zmiana języka zrobiona na innym urządzeniu działa dla adresów bez prefiksu dopiero po kolejnym zalogowaniu albo przełączeniu na tym urządzeniu.
- Strony publiczne mają `hreflang` dla każdego języka i `x-default` na adres bez prefiksu (zgodnie z D47; decyzja użytkownika). Adres bezwzględny z nagłówków żądania, więc produkcja i staging linkują do siebie.

## D50 – Dialog ustawień (2026-11-03)

- Motyw, język, zmiana hasła i wylogowanie przechodzą z sidebaru do jednego dialogu „Settings”, otwieranego z sidebaru; osobnej strony ustawień nie ma (decyzja użytkownika, task 46).
- Motyw w dialogu ma trzy opcje: jasny, ciemny i systemowy.
- Motyw i język wybiera się z list rozwijanych i zatwierdza wspólnym „Save” w prawym dolnym rogu, aktywnym tylko po zmianie; bez podglądu przed zapisem. „Cancel”, krzyżyk i kliknięcie poza dialogiem zamykają go i odrzucają niezapisane zmiany. Po zapisie dialog zostaje otwarty, także po zmianie języka (decyzja użytkownika).
- Sekcja Konto: „Change password” zamienia treść dialogu na formularz z własnym „Save”; „Cancel” i „Close” wracają do ustawień. „Log out” działa od razu.

## D51 – Bez trybu kolumn w edytorze (2026-11-03)

- Tryb „Split” (prawy panel jako osobne kolumny) znika razem z kodem; edytor ma tylko panel boczny z zakładkami (decyzja użytkownika, task 47).
- Zapisane `split`, `order` i szerokości kolumn są ignorowane przy odczycie, bez migracji.
- `widths` to teraz jedna para rozmiarów `story-column` / `side-column`. Przy odczycie starego zapisu (rekord per zestaw kolumn) `normalizeLayout` bierze szerokość zakładek spod klucza `story,side`, więc użytkownik nie traci ustawionej szerokości. Zmienia D27 i odpowiednie punkty o Split w D12, D19 i przy panelu Tools.

## D52 – Łagodniejszy kontrast i jeden motyw kolorystyczny (2026-11-03)

- Oba tryby dostają mniejszy kontrast: w ciemnym tło nie czarne i tekst nie czysto biały, w jasnym tło złamana biel i tekst nie czysto czarny, przy zachowaniu WCAG AA (decyzja użytkownika, task 48).
- ~~Kolor akcentu aplikacji wybiera użytkownik spośród 2–3 propozycji przygotowanych w tasku; jeden motyw dla wszystkich, bez wyboru w ustawieniach.~~ Zmiana przy wyborze propozycji (decyzja użytkownika, 2026-11-04): pięć palet akcentu (sepia, granat, szałwia, śliwka, morski) do wyboru w dialogu ustawień jako próbki kolorów (`appearance.accent`); domyślna sepia. Paleta podbarwia też tła, tekst, ramki, podświetlenie wyszukiwania i komentarze.
- Paleta jest atrybutem `data-accent` na `<html>`, ustawianym przez layout z ustawień zalogowanego użytkownika. Strony publiczne mają paletę oglądającego; bez sesji obowiązuje domyślna (bez kopii w `localStorage`, inaczej niż motyw).
- Kolory w komponentach tylko przez zmienne z `app/globals.css`, także podświetlenia wyszukiwania (`highlight`, `highlight-current`), komentarze (`comment`, `comment-border`), diff wersji (`diff-added`, `diff-removed`) i korekta (`proofread-note`, D59). Wyjątek: przyciemnienie tła pod dialogiem (`bg-black/10`), bo to cień, nie kolor tekstu ani tła treści.
- `color-scheme: dark` w trybie ciemnym, więc natywne kontrolki (listy `<select>`) są ciemne. Kolory `prose` (podgląd markdown, edytor) też idą ze zmiennych.

## D53 – Tooltipy przy przyciskach z samą ikoną (2026-11-03)

- Przyciski bez widocznej etykiety mają stylizowany tooltip (shadcn Tooltip na Radix) z tekstem jak `aria-label`, zamiast natywnego `title` (decyzja użytkownika, task 50).
- `WithTooltip` w `components/ui/tooltip.tsx`, jeden `TooltipProvider` w `app/[locale]/layout.tsx` (opóźnienie 300 ms). Fokus otwiera tooltip tylko przy `:focus-visible`; treść nie przyjmuje kursora. Przyciski chowające etykietę na wąskim ekranie mają tooltip tylko poniżej `md`, zwinięty sidebar po prawej stronie ikon.

## D54 – Strona główna z hero i ostatnio opublikowanymi (2026-11-04)

- Zmienia D38, D42 i D46 (task 49). `/` zostaje jedną stroną dla gościa i zalogowanego, wyszukiwarka zostaje na `/`. Gość widzi hero (nagłówek, opis, „Create account” i „Log in”), potem wyszukiwarkę i „Recently published”; zalogowany to samo bez hero, z sidebarem. Sidebar traci pozycję Search, zostaje Home (decyzje użytkownika).
- Dialog logowania z D42 bez zmian; przycisk w prawym górnym rogu i CTA hero otwierają ten sam dialog, CTA w trybie rejestracji albo logowania.
- „Recently published”: rozdziały widoczne publicznie (warunki jak w wyszukiwarce), sortowane po `publishedAt` malejąco, remis `_id` malejąco. Serwer pobiera 15, klient pokazuje 5 i dokłada po 5. Lista nie zużywa `SEARCH_LIMIT`. Data względna do 7 dni, starsza jako data w języku interfejsu, liczona na serwerze w UTC.
- Nowe pole `stories.publishedAt`: moment pierwszej publikacji rozdziału, ustawiany raz i nigdy nie zmieniany ani nie usuwany (decyzja użytkownika 2026-11-04, zastępuje wcześniejsze „każda publikacja od nowa, ukrycie robi `$unset`”). Dostaje go rozdział, który staje się publiczny i jeszcze go nie ma (Publish folderu, Publish all, Publish rozdziału; `stampPublishedAt` w `lib/publish/mutations.ts`). Unpublish, przeniesienie i przywrócenie z wersji go nie ruszają; o obecności na liście decydują warunki widoczności. Zapisy z `timestamps: false`: edytor wysyła `updatedAt` jako wersję oczekiwaną, więc zmiana publikacji nie może go zmieniać (decyzja użytkownika).
- Rozdział bez `publishedAt` nie trafia na listę. Powtarzalna migracja `006-published-at` daje widocznym rozdziałom bez pola datę uruchomienia (także tym opublikowanym przez starą wersję w trakcie builda). Indeks `{ publication: 1, publishedAt: -1 }`.
- Link Home w sidebarze ma `prefetch={false}`: render `/` czyta listy publiczne, a prefetch z każdej strony (także edytora) robiłby to przy każdym wejściu; jego spóźniona odpowiedź psuła też zaznaczenie w testach E2E edytora.
- Tytuł strony głównej „Story App – write and publish stories” z opisem z hero. U gościa `h1` to nagłówek hero, u zalogowanego „Search stories”.
- Odstępstwo od „tylko desktop” (D46): strona główna jest dopracowana pod wąski ekran (od 375 px); reszta aplikacji w tasku 51 (decyzja użytkownika).

## D55 – Menu akcji (⋮) i przeciąganie zamiast strzałek (2026-11-04)

- Zmienia D17 i D53 (task 52). Akcje stojące obok siebie jako ikony lub przyciski trafiają do menu otwieranego przyciskiem z pionowymi kropkami (shadcn DropdownMenu na Radix z `radix-ui`, `components/ui/dropdown-menu.tsx`). Pozycje mają ikonę i opis, więc nie dostają tooltipów; sam przycisk ⋮ ma `aria-label` i tooltip (D53). Usuwanie zawsze na końcu, czerwone, za separatorem (decyzje użytkownika).
- Menu: wiersz rozdziału na stronie folderu (Tagi, Przenieś, Opublikuj / Cofnij publikację, Usuń), nagłówek folderu (Nowy rozdział | Sortuj › | Tagi, Zmień nazwę | Eksport, Import | publikacja, Opublikuj wszystkie | Usuń), nagłówek `/stories` (Nowe opowiadanie, Nowy folder | Sortuj › | Import), wiersz folderu na `/stories` (Tagi, Zmień nazwę, publikacja, Usuń), górny pasek edytora (Eksport, publikacja, Usuń), wiersz wersji (Przywróć, Usuń). Sortowanie to podmenu z opcjami do wyboru (`SortSelect` znika). Paski z publicznym linkiem i przycisk panelu bocznego edytora zostają poza menu.
- Wiersze rozdziału i folderu pokazują przed ⋮ nieklikalną ikonę stanu publikacji (globus albo globus z kłódką, z tooltipem). Rozdział publiczny w nieopublikowanym folderze ma stan prywatny. Każda zmiana publikacji z menu wymaga potwierdzenia w dialogu.
- Wyniki wyszukiwania na `/stories` i panel rozdziałów w edytorze są tylko nawigacją: bez usuwania i bez zmiany kolejności.
- Dialogi otwierane z menu są sterowane (`open` / `onOpenChange`) i renderowane obok menu, nie w nim, bo zamknięcie menu odmontowuje jego zawartość.
- Przyciski Move up / down (D17) znikają. W trybie manual lista folderów i lista rozdziałów na stronie folderu mają po lewej zawsze widoczny uchwyt do przeciągania (`@dnd-kit/core` + `@dnd-kit/sortable`; `@dnd-kit/react` jest jeszcze 0.x). Mysz od razu po ruchu o kilka pikseli, dotyk po przytrzymaniu uchwytu 250 ms (decyzja użytkownika), klawiatura: spacja, strzałki, spacja. Kolejność zmienia się od razu na kliencie, bez czekania na serwer.
- Akcje `moveFolder(id, index)` i `moveChapter(id, index)` przenoszą element na pozycję w kolejności manual i przenumerowują listę jak dawniej `savePositions`. Indeks musi być nieujemną liczbą całkowitą (inaczej `INVALID_INPUT`), większy niż lista ląduje na końcu.

## D56 – Serwer narzędzi lokalnie w Dockerze, flaga po zmiennych (2026-11-06)

- Decyzje użytkownika. Wszystko, co miało działać na Mikrusie, na czas developmentu działa lokalnie (task 54). W `docker-compose.yml` są Coolify i serwer docelowy w kontenerze (DinD z SSH), a Coolify wdraża na niego usługi jak na Mikrusie: bramkę z sekretem (54), LanguageTool (29), serwis słownikowy (25). Jedno polecenie stawia całość i dopisuje `TOOLS_API_URL` i `TOOLS_API_SECRET` do `.env.local`.
- Prawdziwy serwer (task 28) powstaje na końcu kolejki, po narzędziach z niego korzystających. Pomiary limitów czasu i RAM robimy lokalnie z limitami CPU i pamięci, a w tasku 28 je powtarzamy.
- Flaga: narzędzia korzystające z serwera (korekta, kafelki słownikowe) działają tylko, gdy ustawione są obie zmienne. Bez nich kafelek jest widoczny, a kliknięcie lub szukanie daje komunikat o niedostępności, bez wywołania sieci. Na stagingu i produkcji narzędzia włączają się po ustawieniu zmiennych na Vercelu, bez zmian w kodzie. Klient serwera narzędzi i flagę buduje task 29, pozostałe z nich korzystają.

## D57 – Lokalny serwer narzędzi: polecenia, konto, proxy (2026-11-06)

- Decyzje użytkownika (task 54). Jedno polecenie startuje całość, jedno zatrzymuje: `npm run up` (MongoDB, Coolify, serwer docelowy, wdrożenie bramki, zmienne w `.env.local`) i `npm run down` (`docker compose --profile tools down`, wolumeny zostają). `npm run db:down` usunięty; `npm run db:up` zostaje dla samego MongoDB, tak jak w testach.
- Konto admina Coolify, włączenie API i token zakłada skrypt przez `php artisan tinker` w kontenerze, nie seeder `ROOT_USER_*`: seeder wymaga e-maila z rekordem DNS, sprawdza hasło w HaveIBeenPwned i przy błędzie tylko loguje. Token odtwarzany przy każdym uruchomieniu (stary o tej samej nazwie usuwany).
- Serwer docelowy bez proxy (`proxy_type: none`): port bramki idzie wprost do Caddy, jak we wniosku z testu z 2026-11-01. Traefik dojdzie, gdy będzie potrzebna domena.
- Skrypt w TypeScripcie (`scripts/tools.ts`, `tsx`), bez `curl`/`jq` na hoście; klucz SSH generowany w kontenerze. Porty tylko na `127.0.0.1`: panel 8000 (realtime 6001, 6002), bramka 8110. Wersje przypięte: Coolify 4.6.0, Postgres 15.19, Redis 7.4.12, `docker:29.9.3-dind`, Caddy 2.11.9.

## D58 – LanguageTool na serwerze narzędzi i język folderu (2026-11-06)

- Zmienia D21: tekst rozdziału wysyłany do sprawdzenia trafia na własny serwer narzędzi (lokalnie Docker z taska 54, docelowo Mikrus, task 28), nigdy do zewnętrznej firmy. Sprawdzanie startuje tylko na żądanie (task 23); pisownia na bieżąco zostaje w przeglądarce.
- Decyzje użytkownika: obraz `erikvl87/languagetool:6.8` (przypięty), limit wywołania 120 s (`PROOFREAD_TIMEOUT_MS`), na start bez wyłączonych reguł (`DISABLED_RULES`, dobiera task 23), `PL_WORD_REPEAT` zawsze włączona.
- Kontener: `-Xms128m`, `-Xmx512m`, `mem_limit: 800m`, `langtool_maxCheckTimeMillis=120000` (LT przerywa sprawdzanie, którego aplikacja już nie czeka). Bramka kieruje `/lt/*` do LT. Healthcheck kontenera wysyła krótkie polskie sprawdzenie, więc rozgrzewa LT także po restarcie poza `npm run up` (pierwsze żądanie po starcie jest kilka razy wolniejsze).
- Akcja `checkChapter(id)` bierze treść z bazy po `id` i `userId` z sesji, więc `bodySizeLimit` nie ma znaczenia (wysyłane jest tylko `id`). Zwraca sprawdzaną treść, żeby task 23 mógł wykryć, że pozycje nie pasują już do tekstu w edytorze. Limit: 10 sprawdzeń na 10 minut na użytkownika (`PROOFREAD_LIMIT`). `maxDuration = 130` na stronie edytora, powyżej limitu wywołania (Vercel z Fluid compute pozwala do 300 s).
- Wyjątek od „Server Actions do zapisu”: sprawdzanie jest Server Action, choć nic nie zapisuje (decyzja z taska 23). Akcje klienta idą po kolei, więc w czasie sprawdzania czekają też autozapis i zmiana języka folderu; task 23 opróżnia autozapis przed startem.
- Tekst idzie w parametrze `data`: składnia markdownu, komentarze, kod, adresy linków i tabele to markup, każde złamanie linii i granica bloku czytane jako nowy akapit (`\n\n`). Pozycje błędów są pozycjami w źródle markdown. Blok, którego nie da się odwzorować z tokenów `marked`, dzielony jest prostszą metodą (prefiksy linii i znaczniki jako markup).
- Język folderu (zakres dawnego taska 31, D44): pole `language` w folderze, w bazie tylko wybrana wartość, brak pola to polski. Dlatego bez migracji: istniejące foldery działają jak polskie bez zmian w danych. Lista języków (`FOLDER_LANGUAGES`, dziś tylko `pl`) to języki obsługiwane zarówno przez korektę LT, jak i przez słowniki (decyzja użytkownika); język trafia do atrybutu `lang` pól tekstu (treść, notatki rozdziału i folderu, tytuły) i do parametru `language` LT. Selektor „Language” w menu folderu jest już teraz, mimo jednej opcji (decyzja użytkownika).
- Zmienia D44: słowniki otwierane z narzędzi (taski 25, 32–34) działają dla języka folderu, a nowy język trafia na listę dopiero, gdy obsługują go korekta i słowniki.
- Klient serwera narzędzi (`lib/tools/client.ts`) i flaga z D56: bez `TOOLS_API_URL` albo `TOOLS_API_SECRET` akcja zwraca `TOOL_UNAVAILABLE` bez wywołania sieci. Adres, sekret i treść błędów serwera nie trafiają do klienta; błędy to tylko kody `TOOL_UNAVAILABLE` i `TIMEOUT`.

## D59 – Korekta w dialogu w stylu propozycji zmian (2026-11-06)

Dialog, panel i „Accept” zastąpiła korekta w głównym edytorze (D66); sprawdzanie, mapowanie pozycji, zakreślenia i reguły obowiązują dalej.


- Zmienia D21: gramatykę, interpunkcję i styl sprawdza na żądanie LanguageTool na serwerze narzędzi (D58). Pisownia na bieżąco zostaje w przeglądarce. Sprawdzanie jest Server Action mimo braku zapisu: to wyjątek od zasady „Server Actions do zapisu” (decyzja użytkownika, D58).
- Kafelek „Proofread” w Tools sprawdza treść otwartego rozdziału. Najpierw zapisuje rozdział i notatki folderu (pusty tytuł daje komunikat bez sprawdzania), potem woła `checkChapter`. Treść zwrócona przez akcję musi być równa tej w edytorze, inaczej dialog prosi o ponowne sprawdzenie. Zamknięcie dialogu w trakcie odmontowuje widok, więc spóźniona odpowiedź jest ignorowana. Wyjątek akcji (np. „Failed to find Server Action”) daje komunikat.
- Dialog działa jak propozycje zmian w GitHub Copilot (decyzja użytkownika). Pokazuje cały rozdział w edytowalnym Tiptap z tymi samymi rozszerzeniami co Preview. Tekst do usunięcia ma czerwony zakreślacz, a podpowiedź stoi za nim jako zielony wstawiony tekst z ✓ i ✗. Kolor znaków się nie zmienia, a tła to `--diff-removed` i `--diff-added` z diffu wersji. Błąd bez podpowiedzi ma żółty zakreślacz `--proofread-note` i tylko ✗. Własny tekst wpisuje się wprost w dialogu. Panel obok tekstu (na wąskim ekranie pod nim) pokazuje rodzaj, opis LT, listę podpowiedzi (wybór zmienia zielony tekst), ✓/✗ i nawigację; to też jedyna droga z klawiatury, bo przyciski w tekście są poza polem edycji.
- Pozycje: offsety LT liczone są w źródle markdown (D58). Znaki tekstu z `annotateMarkdown` dopasowuje się do znaków węzłów tekstowych dokumentu (bez komentarzy), a przy różnicy (np. encje) służy do tego `diffChars`. Błąd zostaje tylko wtedy, gdy cały zakres to tekst i daje ciągły fragment dokumentu. Błędy obejmujące składnię markdown, złamanie linii albo escape są odrzucane (decyzja użytkownika), podobnie nakładające się na wcześniejszy. Propozycje mapują się przez transakcje; edycja wewnątrz zakresu usuwa propozycję.
- ✓ zamienia tekst z formatowaniem pierwszego znaku. Undo w dialogu cofa tekst, ale propozycja nie wraca. W trybie deweloperskim (StrictMode) sprawdzenie startuje dwa razy i zużywa dwie próby limitu; produkcja nie jest dotknięta. Decyzję można zmieniać do ✓/✗; potem tekst poprawia się ręcznie. Propozycja bez decyzji nie zmienia tekstu.
- „Accept” zamyka dialog, a treść trafia do edytora rozdziału dopiero w `onCloseAutoFocus`, bo modalny dialog trzyma fokus, którego Source potrzebuje do natywnego Undo. W Preview zmieniany jest tylko różniący się fragment dokumentu (`findDiffStart`/`findDiffEnd`) z `closeHistory`, a w Source tylko różniący się fragment tekstu przez `execCommand`. W obu trybach to jeden krok Undo, po którym zapis startuje od razu. Gdy w dialogu były tylko ✓, podpowiedzi wstawia się w źródło po offsetach LT (znaki markdown w podpowiedzi są escapowane), więc reszta markdownu zostaje bajt w bajt. Gdy użytkownik pisał w dialogu (albo cofał), treść to `getMarkdown()` dialogu, czyli zapis Tiptap jak po każdej edycji w Preview; w Source może to dać większą zmianę niż sama poprawka. Dialog bez zmian w tekście niczego nie zapisuje. Gdy LT zgłosił błędy, ale żadnego nie da się umieścić w tekście (np. dopasowanie znaków przekroczy 500 ms), dialog mówi o tym zamiast „brak błędów”. Na wąskim ekranie widok przełącza się na treść, bo pole pod `visibility: hidden` nie przyjmuje fokusu.
- Reguły: `DISABLED_RULES = ["BOWIEM_ZAS"]` („Ale” na początku zdania, typowe w prozie), na podstawie próbki prozy z dialogami. Pozostałe fałszywe alarmy z próbki (`COFANIE_PRZECINKA` przy „Teraz, kiedy”, `PL_WORD_REPEAT` przy celowym „Dobry, dobry”) odrzuca się ✗. Komentarze nie są sprawdzane (markup, D58).

## D60 – Słownik użytkownika w korekcie (2026-11-06)

- Task 30. Słownik jest per konto (`settings.proofreading.dictionary`, D24), bez pola domyślnego w modelu, więc dokument dostaje listę dopiero po pierwszym dodaniu. Pole nie jest `clientWritable`: zmieniają je tylko akcje `addToDictionary` i `removeFromDictionary` (jedno słowo), a `saveSettings` odrzuca je z `INVALID_INPUT`. Obie akcje zwracają całą listę i niczego nie rewalidują, bo odświeżenie przerenderowałoby otwarty edytor.
- Słowo (decyzja użytkownika): po `trim()`, NFC, apostrof `’` zamieniany na `'`, 1–50 znaków UTF-16, bez białych znaków; najwyżej 1000 słów na konto. Złe słowo i pełny słownik dają `INVALID_INPUT` z osobnymi komunikatami. Dodanie jest jednym warunkowym `$push` (słowa jeszcze nie ma, element 1000 nie istnieje), więc równoległe dodania nie przekroczą limitu ani nie zapiszą słowa dwa razy. Dodanie istniejącego słowa jest `ok`, usunięcie brakującego też. Limit liczy zapisaną tablicę: uszkodzone wpisy (pomijane przy odczycie) zajmują miejsce, czego przy zapisie tylko przez akcje nie ma.
- Dopasowanie jak w Hunspellu (decyzja użytkownika): słowo zapisane małymi literami pasuje też w formie z wielkiej litery i WERSALIKAMI, słowo z wielkimi literami tylko dokładnie i WERSALIKAMI. Odmiany to osobne słowa (do czasu serwisu słownikowego, task 25).
- Filtr działa w `checkChapter`, przed zwróceniem wyników, tylko dla błędów rodzaju „pisownia” (`issueKind`: kategoria `TYPOS`/`SPELLING` albo `misspelling`), nie po id reguły – obejmuje też pisownię innych języków. Porównywany jest fragment źródła markdown z offsetów LT, więc słowo rozcięte formatowaniem (`An**ia**`) nie jest filtrowane.
- Dialog korekty: „Add to dictionary” w panelu przy błędzie pisowni, gdy zaznaczony tekst jest poprawnym słowem. Po zapisie znikają od razu wszystkie oczekujące propozycje pisowni tego słowa (także w innych formach wielkości liter). Undo w dialogu ich nie przywraca, jak przy ✗ (D59).
- Lista w dialogu Settings, sekcja „Proofreading dictionary”: wczytywana akcją `listDictionary` przy każdym otwarciu (jak `checkChapter`, wyjątek od odczytu w Server Components – dialog jest w layoucie, a słowa dochodzą z korekty bez przeładowania strony). Słowa posortowane `localeCompare` w języku interfejsu, liczba słów, usuwanie od razu przyciskiem przy słowie (bez „Save”), fokus przechodzi na następny przycisk albo nagłówek sekcji.

## D61 – Serwis słownikowy i tabela form (2026-11-06)

- Task 25. Tabela form to **PoliMorf** 2026-10-18 (decyzja użytkownika po pomiarach obu źródeł: jakość ważniejsza od zasobów). Przy tych samych czasach i RAM rozpoznaje 92% słów współczesnych wobec 69% w Morfologiku (dane z 2016 r.); wyniki w `docs/tasks/done/25-dictionary-service.md`. Kod tagów piszemy pod tagi PoliMorfu (`subst:sg:gen.acc:m2`).
- Serwis w Node (`node:24.22.2-alpine`, wbudowany `node:sqlite`, bez pakietów; decyzja użytkownika) na serwerze narzędzi za bramką (`/dict/*`), limit 128 MB, kod jako plik `content:` w `docker/tools/compose.yml`. `POST /lemmas` z `{"forms": [...]}` (najwyżej 4 formy po 50 znaków, ciało do 1 KB) zwraca `{source, rows: [{form, lemma}]}`, `GET /health` – źródło, wersję i datę budowy. Bez bazy: 503. Plik otwierany tylko do odczytu i od nowa po zmianie i-węzła, więc wgranie nowej bazy nie wymaga restartu.
- Baza: SQLite `forms(form, lemma_id, tag_id)` `WITHOUT ROWID` z kluczem po formie i indeksem po lemacie, słowniki `lemmas` i `tags`, licencja PoliMorfu w `meta`. Budowa lokalnie (`npm run dict:build`, plik źródłowy z sumą SHA-256), wgranie `npm run dict:upload` strumieniem na wolumen usługi i `mv`. Dane i plik bazy tylko w `.tools/dict/` (poza repo); licencja BSD wymaga zachowania notki, która jedzie w bazie.
- Aplikacja: `lookUpLemmas(word)` to Server Action, choć nic nie zapisuje (jak `checkChapter`, D58): słowo jedzie w treści POST, nie w adresie z logów. Wymaga sesji; bez `TOOLS_API_URL`/`TOOLS_API_SECRET` zwraca `TOOL_UNAVAILABLE` bez sieci (D56). Słowo jak w słowniku użytkownika (D60: `trim`, NFC, `’`→`'`, 1–50 znaków, bez spacji), inaczej `INVALID_INPUT`. Limit wywołania 2 s (`DICTIONARY_TIMEOUT_MS`): akcje klienta idą po kolei, więc autozapis czeka za szukaniem najwyżej tyle. Błędy to tylko `TOOL_UNAVAILABLE` i `TIMEOUT`, bez adresu i treści odpowiedzi serwera. Bez cache po stronie serwera.
- Wielkość liter: do serwisu idą formy jak wpisane, małymi, z wielkiej i wersalikami („Kota” na początku zdania znajduje kot i kota, „nato” – NATO). Lematy formy wpisanej dokładnie są pierwsze, każdy lemat raz, każdy z etykietą źródła (`source: "polimorf"`) do atrybucji. Brak formy to pusta lista.
- Blok „Sources”, E2E autozapisu przy zawieszonym serwisie i komunikat przy „Failed to find Server Action” powstają z pierwszym kafelkiem w tasku 32 (decyzja użytkownika); atrapa E2E odpowiada już na `/dict/lemmas`.

## D62 – Definicje z Wikisłownika (2026-11-06)

- Task 32. Kafelek „Definitions” w Tools. Źródło: polska edycja Wikisłownika ze zrzutu kaikki.org (`lang_code == "pl"`), nie angielski „Polish”. Tekst na CC BY-SA 4.0 (dziedziczone po Wikisłowniku); kaikki podaje tylko najnowszy zrzut, więc plik trzymany jest lokalnie pod datą `Last-Modified`, a jego suma SHA-256 i data trafiają do `meta` bazy. WSJP, sjp.pl i PWN tylko jako linki otwierane przez użytkownika w nowej karcie; serwer niczego z nich nie pobiera.
- Baza (decyzja użytkownika): osobny plik `definitions.sqlite` w tym samym serwisie słownikowym co tabela form, bo definicje zmieniają się co tydzień, a PoliMorf rzadko. Tabela `entries(word, data)` z wszystkimi hasłami nagłówka jako JSON (część mowy, polska nazwa części mowy, znaczenia z numerem Wikisłownika, etykietami, regionem i najwyżej 2 przykładami). Serwis otwiera każdy plik osobno: bez bazy form 503 dają wszystkie trasy, bez definicji tylko `/definitions`. `POST /definitions` z `{"forms": [...]}` (te same limity co `/lemmas`) zwraca wiersze lematów jak `/lemmas` i hasła form oraz najwyżej 8 lematów, w jednym wywołaniu z limitem 2 s (`DICTIONARY_TIMEOUT_MS`).
- Czyszczenie przy imporcie: prefiks „gw. (Region)” i „reg. (Region)” przechodzi z tekstu do etykiety gwarowej lub regionalnej z regionem. Odsyłacze („lm od: lut”, „aspekt dokonany od: odczytywać”) wypadają, gdy hasło ma inne znaczenia; hasło z samymi odsyłaczami zostaje (z flagą `reference`), a aplikacja chowa je, gdy pokazuje hasło z prawdziwymi znaczeniami (np. „tego” → „ten”). „rzecz. odczas. od …” i „zob. …” zostają w tekście.
- Etykiety (decyzja użytkownika): 24 najczęstsze etykiety Wikisłownika (potocznie, przestarzale, książkowo, wulgarnie, gwarowo z regionem…) jako znaczniki tłumaczone na en/pl; dziedziny i rzadkie etykiety pomijane. Znaczenia gwarowe i regionalne na końcu hasła (decyzja użytkownika), z oryginalnym numerem Wikisłownika, bo odsyłacze w tekście („miasta (1.1)”) go używają.
- Kolejność grup: słowo jak wpisane, jego lematy (jak `rankLemmas`), inne zapisy wielkości liter; najwyżej 8. Grupa innego hasła niż wpisane ma nagłówek „Shown for: kot”. Każda grupa kończy się linkiem do hasła w Wikisłowniku i „CC BY-SA 4.0”. Linki Wikisłownik, sjp.pl i PWN dla wpisanego słowa są widoczne też przy braku wyniku i przy błędzie.
- Blok „Sources” (`tool-sources.tsx`, `lib/tools/sources.ts`), wspólny dla tasków 32–34: źródła wyników z licencją; Wikisłownik z notą o zmianach (wymóg CC BY-SA), PoliMorf (BSD 2-Clause), gdy pokazano lemat.
- Ostatnie zapytanie i wynik zostają w pamięci modułu do przeładowania strony (decyzja użytkownika): po zamknięciu dialogu, zmianie zakładki, a także rozdziału i opowiadania. Zapisuje je tylko najnowsze zapytanie. Formularz jest zablokowany w czasie szukania. Wyjątek akcji („Failed to find Server Action”) daje komunikat.
- Język folderu (D58): lista to dziś tylko polski, więc kafelek nie sprawdza języka; pole i wyniki mają atrybut `lang` folderu. Nowy język wymaga osobnego źródła definicji.

## D63 – Synonimy z Wikisłownika i Dobrego słownika (2026-11-06)

- Task 33. Kafelek „Synonyms” w Tools. Research przy starcie (pomiary w `docs/tasks/done/33-synonyms.md`), źródła wybrane przez użytkownika:
  - **Wikisłownik**: synonimy z tego samego zrzutu kaikki co definicje (D62), CC BY-SA 4.0. Definicje i synonimy budowane są w jednym przejściu po zrzucie, a `--refresh` zawsze przebudowuje obie bazy, więc mają tę samą wersję zrzutu.
  - **Dobry słownik**: tezaurus `th_pl_PL_v2.dat` z paczki `pl-dict-latest.oxt` (wydanie kwartalne). Opieramy się na README w paczce `.oxt`, które daje tezaurusowi „GNU Lesser General Public License Version 2.1” z liniami „Copyright (C) 2014-2026 Dobry słownik” i „Copyright (C) 2004-2014 Marcin Miłkowski”, nie na `thesaurus.txt-latest.gz` (nagłówek GPL 2+). Paczka trzymana jest lokalnie pod datą `Last-Modified` (jak zrzut kaikki). `dict:build` przerywa pracę, gdy tezaurus nie jest w UTF-8, licencja nie jest LGPL albo linie copyright różnią się od `SOURCES.dobryslownik.copyright`.
  - **Odrzucone**:
    - tezaurus LibreOffice 2017: starsza wersja tych samych danych, dodaje 94 hasła (głównie marki) i 1,2% par, w tym błędy później usunięte;
    - Słowosieć 4.2: pobiera się z CLARIN jako zrzut roboczej bazy MySQL (2,3 GB) i dodaje +2,4 pp pokrycia przy dużym szumie (kot → gach, drapak), a jej notka i zastrzeżenia muszą być przy każdej kopii. Można wrócić osobnym taskiem.
- Baza: osobny plik `synonyms.sqlite` w serwisie słownikowym, z tabelą na źródło (`wiktionary`, `thesaurus`). `POST /synonyms` (te same limity co `/definitions`) zwraca wiersze lematów i synonimy form oraz najwyżej 8 lematów z obu tabel. Bez pliku 503 daje tylko ta trasa.
- Czyszczenie Wikisłownika:
  - „gw./reg./sł. (Region) a, b” i „reg. pozn. x” dają etykietę gwarową lub regionalną z regionem. Skróty regionów są rozwinięte (pozn. → Poznań), a nieznane zostają w oryginalnym zapisie. Lista po przecinku jest dzielona.
  - „stpol.” (staropolskie) to „obsolete”, „pot.” to „colloquial”, „wulg.” to „vulgar”, a „neutr.” znika.
  - „zob.” i „por.” wypadają.
  - Powtórzone słowo w jednym znaczeniu jest scalane.
  - Synonimy są pogrupowane według numeru znaczenia z definicją tego znaczenia. Zakresy („1.1-2”) łączą definicje, przycięte do 200 znaków.
- Czyszczenie tezaurusa:
  - Kwalifikatory („(potocznie) chata”) stają się etykietami. Do etykiet Wikisłownika (D62) dochodzą „bardzo potocznie”, „specjalistycznie”, „ekspresywnie” i „środowiskowo”. „Częściej” i nieznane kwalifikatory wypadają.
  - Samo hasło i powtórzone znaczenia są usuwane.
  - Etykiety właściwe tylko tezaurusowi nie są przyjmowane z Wikisłownika.
- Widok (decyzja użytkownika): pod każdym hasłem osobna sekcja na źródło. Najpierw Wikisłownik (część mowy, numer i definicja znaczenia), potem Dobry słownik (numerowane znaczenia).
  - Słowo podane przez oba źródła jest w obu sekcjach (decyzja użytkownika). Każde wystąpienie ma własne etykiety rejestru i oznaczenia wszystkich źródeł, które je podają (WS, DS).
  - Kolejność i limit haseł oraz „Shown for” jak w D62 (`orderHeadwords`).
  - Link do hasła w Wikisłowniku i „CC BY-SA 4.0” w każdej sekcji Wikisłownika. Bez linków do zewnętrznych słowników.
- Blok „Sources”: źródła widocznych sekcji z licencją. Dobry słownik ma obie linie copyright i link do tekstu LGPL 2.1. Notę o zmianach (wymóg CC BY-SA i LGPL) każdy kafelek podaje osobno. PoliMorf pojawia się, gdy pokazano lemat.
- Formularz, blokada i pamięć wyniku do przeładowania są wspólne z definicjami (`lookup-tool.tsx`), ale każdy kafelek ma osobny stan. Wspólne teksty są w przestrzeni `lookup`, etykiety w `tools.labels`.

## D64 – Rymy z kluczy fonetycznych tabeli form (2026-11-06)

- Task 34. Kafelek „Rhymes” w Tools. Transkrypcja i klucze według researchu z taska (`lib/tools/rhyme-key.ts`, wspólne dla `dict:build` i aplikacji). Odstępstwa od specyfikacji w tasku:
  - akcent na trzeciej sylabie od końca daje `ł[aoy]by[mś]?$` z obowiązkową samogłoską (`zrobiłbym` → `iwbym`), bo wzorzec z researchu przesuwał akcent także w `-łbym`;
  - `-eusz` (Tadeusz, Mateusza) to dwie sylaby, jak `-eum` i `-eus`;
  - wyjątki ze spisu: zapożyczenia `-nia` z /j/ (mania, harmonia), `rz` jako r+z (zamarzać, marznąć), kilka pisowni obcych (pizza, boss, podcast) i spójniki ze `-śmy`/`-ście` (żebyśmy). Liczebniki `-set`/`-kroć` i przedrostki `arcy-`, `eks-`, `wice-` zostały bez zmian.
- Poziomy: Exact (ogon od akcentowanej samogłoski), Near (i=y, końcowe ą=o, spółgłoski według klasy, ciąg jednej klasy liczony raz) i Last syllable (z i=y i ą=o; przy końcówce otwartej z poprzedzającą spółgłoską, bez niej brak klucza). Słowo jest pokazane tylko na najlepszym poziomie.
- Lista częstości (decyzja użytkownika po próbie na tych samych słowach): **wordfreq `large_pl` 3.2** (CC BY-SA 4.0, © 2022 Robyn Speer; dane z Wikipedii, OpenSubtitles 2018, wiadomości, stron WWW, Twittera i Reddita). Ma częstość 306 tys. form tabeli, a FrequencyWords `pl_50k` tylko 43 tys. i ranking bliższy mowie z napisów. Plik jest przypięty do wydania sumą SHA-256 i dekodowany własnym dekoderem MessagePack (bez pakietu). Kolumna częstości czyni bazę rymów utworem share-alike: blok „Sources” podaje wordfreq z licencją i źródłami danych oraz notę, że zbudowana z nimi baza jest na CC BY-SA 4.0. `meta` bazy ma tę licencję.
- Baza: osobny plik `rhymes.sqlite` (ok. 660 MB, ok. 2 min budowy). Pisowniom bez znaków diakrytycznych, które wordfreq liczy jako częste, a PoliMorf ma tylko jako rzadkie słowa („sie”, „cie”, „juz”…), baza zeruje częstość, żeby nie wychodziły jako częste rymy. Rozmiar zaakceptował użytkownik zamiast przycinania nazw własnych lub gerundiów. Zawiera wszystkie formy z małej litery (także z q, v, x). Są w niej też nazwy własne z PoliMorfu (decyzja użytkownika), o ile to samo słowo nie występuje małą literą („Kot” obok „kot”). Częstość nazwy to częstość słowa małą literą, bo wordfreq ma tylko takie. Kolumny `form`, `phones`, `exact`, `near`, `last`, `freq` (Zipf × 100), `lemmas` (id lematów z tabeli form, z której zbudowano bazę: `meta` podaje jej datę), `flags`. Indeksy `(klucz, freq DESC)` na każdy poziom i na `form`; wiersze w kolejności odwróconej transkrypcji, więc wiersze jednego klucza leżą obok siebie. Zapytanie trwa poniżej 1 ms na poziom.
- Serwis: `POST /rhymes {forms, keys}` zwraca wiersze pisowni słowa i najwyżej 150 najczęstszych wierszy każdego poziomu. Pisownia z tabeli przynosi własne klucze (akcent według tagów `cond`/`praet`). Klucze z aplikacji (słowo spoza tabeli liczone jak czasownik) są tylko zapasem i serwis sprawdza ich znaki. Bez pliku 503 daje tylko ta trasa. Słowo bez samogłoski nie wysyła zapytania.
- Ranking w aplikacji (`rankRhymes`):
  - odrzuca samo słowo, formy jego lematów i słowa, z których jedno jest drugim z przedrostkiem słowotwórczym, także po „nie” (pisanie/napisanie, lot/przelot). Inny początek zostawia słowo (ma → mama, zima; kot → szkot; lot → samolot): sam sufiks w pisowni zerował wyniki krótkich słów (decyzja użytkownika);
  - porządkuje według najdłuższego wspólnego zakończenia transkrypcji, potem częstości;
  - pokazuje najwyżej 2 formy na lemat w całym wyniku;
  - widoczne są częste słowa (Zipf ≥ 2,5), najwyżej 40 na poziom; „Show more” dokłada do 100 rzadkich i obniżonych.
- Obniżane (do „Show more”):
  - słowa funkcyjne: forma z odczytem spójnika lub zaimka osobowego albo tylko z odczytami partykuły, przyimka lub wykrzyknika, plus krótka lista zaimkowych przysłówków (tak, tam, teraz…); „bomba” czy „koło” zostają;
  - formy z samymi odczytami gerundium lub imiesłowu;
  - rym gramatyczny: kandydat z odczytem odczasownikowym, gdy wpisane słowo też go ma, a wspólne zakończenie nie wychodzi poza klucz (kochanie → pytanie, zadanie w „Show more”, a panie, ścianie i przesłuchanie widoczne).
- Pomiar na Panu Tadeuszu (księgi 1–5, akapity wierszy o parzystej liczbie linii, kolejne linie w parach, é→e): 1687 par, mniej niż 1825 w researchu, bo inna ekstrakcja. Pokrycie z kluczami z bazy: 86,5% / 94,3% / 97,0% (próg: 83,5 / 91,0 / 94,3). Partnerów rymów w tabeli: 93,1%.
- Rymy wielowyrazowe, asonans i filtry (task 35, D65) poza zakresem.

## D65 – Filtry rymów (2026-11-06)

- Task 35. Kafelek „Rhymes” ma pod polem słowa filtr części mowy i zakres liczby sylab „od–do” (decyzje użytkownika, wzorem Rymera). Filtrowanie robi serwis w SQL przed limitem 150 wierszy na poziom (decyzja użytkownika), więc lista jest pełna także przy wąskim filtrze. Ranking, „Show more” i limit form na lemat działają bez zmian na przefiltrowanej puli. Wiersze pisowni wpisanego słowa nie są filtrowane, bo z nich biorą się jego lematy i klucze.
- Części mowy (`partsOfSpeech` w `lib/tools/rhymes-import.ts`): pięć grup jako bity, a forma należy do grup wszystkich swoich odczytów („koło”: rzeczownik i inna):
  - rzeczownik: `subst`, `depr`, `ger`;
  - przymiotnik: `adj`, `adjc`, `pact`, `ppas`;
  - czasownik: `fin`, `bedzie`, `praet`, `impt`, `inf`, `imps`, `cond`, `winien`, `pcon`, `pant`;
  - przysłówek: `adv`, `pacta`;
  - inna: pozostałe, także `adja` (polsko-) i `adjp` (po polsku).
  
  Gerundia i imiesłowy odmienne są przy słowach, jak które się odmieniają. Nazwy własne mają tag `subst`, więc są rzeczownikami. Test pilnuje, że każda klasa z tabeli tagów ma grupę.
- Liczba sylab to liczba samogłosek transkrypcji z taska 34 (`syllableCount`): `i` zmiękczające i `u` w `au`/`eu` czytanym jako `w` nie tworzą sylaby. Zakres 1–6, gdzie 6 znaczy „6 i więcej”. W polu „do” nie da się wybrać wartości mniejszej niż „od”, i odwrotnie.
- Baza rymów: kolumny `pos` (bity) i `syllables`. Indeksy poziomów rozszerzone do `(klucz, freq DESC, pos, syllables)`, więc filtr sprawdza się w indeksie bez czytania wierszy. Najgorszy przypadek (klucz `my`, 607 tys. form, filtr bez wyników) trwa 48 ms zamiast 120 ms. Baza ma ok. 734 MB.
- Serwis: `POST /rhymes` przyjmuje opcjonalne `filters: {pos?, min?, max?}` (bity 1–31, `min` 1–6, `max` 1–5 jako górna granica, bo 6 to „6 i więcej”; `min ≤ max`). Błędne dają 400, a aplikacja wysyła tylko filtry zawężające. Akcja `lookUpRhymes(word, filters)` sprawdza filtry tak samo (`parseRhymeFilters`). Błędne dają `INVALID_INPUT`, bez cichego pokazywania pełnej listy. Wynik niesie filtry, z którymi go znaleziono.
- Interfejs: zmiana filtra od razu szuka ponownie słowa z ostatniego wyniku (nie tekstu z pola, jeśli zmieniony bez szukania). Filtry nie są blokowane w trakcie wyszukiwania, więc przechodzenie strzałkami po opcjach nie gubi fokusu. Zmiany z tego czasu dają jedno kolejne wyszukiwanie z aktualnymi filtrami. Pola sylab są w grupie „Syllables”. Filtry są w stanie modułu, jak ostatnie wyszukiwanie (D62). Pusty wynik przy aktywnych filtrach ma osobny komunikat. „Clear filters” wraca do pełnej listy i przenosi fokus na pierwszy filtr.
- Wdrożenie: najpierw `dict:upload rhymes`, potem `npm run up`. Stary kod serwisu wybiera kolumny po nazwie i działa z nową bazą, a nowy kod ze starą bazą dawałby 500.

## D66 – Korekta w głównym edytorze (2026-11-06)

- Zmienia D59 (decyzja użytkownika z ręcznych testów): poprawki trafiają do edytora rozdziału, żeby podczas korekty działały słowniki i inne narzędzia. Dialog z całym rozdziałem, panel i końcowe „Accept” znikają.
- Kafelek otwiera okno z pytaniem „Czy chcesz użyć narzędzia do korekty?”, opisem mniejszą, wyszarzoną czcionką oraz „Sprawdź” i „Anuluj”; LanguageTool dostaje tekst dopiero po „Sprawdź”. Przy otwartej korekcie okno pyta o nowe sprawdzenie, które zastępuje pozostałe poprawki. Okno zostaje modalne przez całe sprawdzanie, więc treść się w tym czasie nie zmienia. Gdy żadna poprawka nie pasuje do tekstu (albo nie ma błędów), okno pokazuje komunikat; inaczej się zamyka.
- Poprawki to dekoracje w Preview z zakreśleniami i ✓/✗ z D59. Nad tekstem jest pasek „Proofreading” z pozycją, poprzednią/następną poprawką i „Zakończ korektę” (usuwa pozostałe poprawki, tekst zostaje). Szczegóły bieżącej poprawki (rodzaj, opis, podpowiedzi, ✓/✗, „Dodaj do słownika”) są w niemodalnym dymku Radix Popover przy zakreśleniu. Kliknięcie w zakreślenie otwiera dymek bez zabierania fokusu z tekstu; krok w pasku i start korekty przenoszą fokus do dymka.
- ✓ zmienia tekst od razu jak zwykła edycja Preview (krok Undo, zapis Tiptap), więc wierność źródła bajt w bajt z D59 znika. Tekst można swobodnie edytować; edycja wewnątrz zakresu usuwa poprawkę. Po ostatniej decyzji pasek znika. Przełączenie na Source jest zablokowane, dopóki są poprawki; start korekty z Source przełącza na Preview.
- Stan korekty jest polem `proofreading` rozdziału (opcjonalne, bez migracji): poprawki z offsetem w tekście dokumentu (węzły tekstowe bez komentarzy), tekstem, opisem LT i wybraną podpowiedzią oraz indeks bieżącej poprawki. Pozycje ProseMirror i offsety LT nie są zapisywane, bo po ponownym wczytaniu markdownu lub pierwszej edycji przestają pasować. Przy wczytaniu poprawka wraca, gdy jej tekst jest pod offsetem albo najbliżej niego w oknie 100 znaków jako jeden ciąg tekstu; inaczej znika.
- Stan zapisuje się w `saveStory` razem z treścią, z tej samej transakcji edytora. Decyzje bez zmiany tekstu (✗, wybór podpowiedzi, bieżąca pozycja) też uruchamiają autozapis. `null` usuwa stan, brak argumentu go nie zmienia. Akcja waliduje kształt i limity (1000 poprawek, długości tekstów; pełny stan zostaje daleko poniżej limitu 4 MB żądania Server Actions) i odrzuca błędny stan bez zapisu. Te same limity obowiązują przy umieszczaniu poprawek w tekście, więc edytor nie pokazuje niczego, czego nie zapisze. Gdy przy otwarciu żadna zapisana poprawka nie pasuje do tekstu, stan usuwa najbliższy zapis. Przywrócenie wersji, które zmienia treść, oraz przywrócenie usuniętego rozdziału usuwają stan.

## D67 – Oznaczenie 18+ (2026-11-09)

- Task 65 (subtask 66), decyzje użytkownika. Pole `adult: { manual?, auto? }` na folderze i rozdziale (wspólny typ `AdultMark` w `lib/adult/adult.ts`, ten sam dla obrazków w tasku 26). `manual` ustawia właściciel, `auto` filtr obrazków. Brak pola to nie 18+, więc bez pliku migracji.
- Dziedziczenie: folder 18+ czyni 18+ wszystkie swoje rozdziały (wyliczane przy odczycie, `chapterAdultState`); rozdział 18+ nie oznacza folderu. Przeniesiony rozdział zachowuje własne `manual` i dziedziczy z nowego folderu.
- Blokada: zdjęcie 18+ zwraca `ADULT_LOCKED`, gdy jest `auto` (obrazek) albo, dla rozdziału, gdy folder jest 18+. Zdjęcie `auto` (usunięcie lub wymiana obrazka) zostawia `manual`, jeśli było.
- Przełącznik: pozycja „Oznacz jako 18+” / „Zdejmij 18+” w menu ⋮ (wiersz i nagłówek folderu, wiersz rozdziału, edytor) z potwierdzeniem w dialogu; zablokowana pozycja jest wyłączona i pokazuje powód.
- Znaczek 18+: lista folderów, wyniki wyszukiwania `/stories`, strona folderu, edytor, publiczny spis, strona czytania, wyszukiwarka i ostatnio opublikowane. W publicznym spisie folderu 18+ znaczek tylko przy nazwie folderu.
- Strona czytania rozdziału 18+ pokazuje zamiast treści ostrzeżenie („Mam ukończone 18 lat” / „Wróć” do spisu); odpowiedź w cookie `adult-confirmed` na rok. Bez filtra w wyszukiwarce.
- Zmiana oznaczenia nie zmienia `updatedAt` ani `lastActivityAt` (jak D11). Oznaczenie nie trafia do eksportu ani do wersji folderów (D25).

## D68 – Okładki folderów: decyzje przy starcie taska 26 (2026-11-09)

- Globalny limit łącznego rozmiaru okładek w zmiennej `COVERS_MAX_TOTAL_MB` (domyślnie 200 MB); po pomiarze danych w Atlasie użytkownik zmienia tylko zmienną.
- Kopia przed migracją (zmienia D14): usunięcie starej kopii, nowa kopia `$out`, potem `up`; zostaje jedna kopia zamiast trzech, a kolekcja `covers` nigdy nie jest kopiowana. Backup poza Atlasem zostaje ręczny (`scripts/backup.sh` przed wydaniem, `docs/deploy.md`).
- `scripts/backup.sh` obejmuje `covers` w archiwum i w `json/`.
- Model: sam OwenElliott `image-safety-classifier-s` (ONNX, `onnx/image-safety-classifier-s.onnx`, SHA-256 `fef443ed68ae25ed693b6fef9e456071692ed3963cff4168acb39c3de6f017e7`), pobierany przy pierwszym starcie usługi do wolumenu i sprawdzany sumą. Próg 18+ (`nsfw` lub `nsfl`) w zmiennej aplikacji `COVERS_ADULT_THRESHOLD`, domyślnie 0,5, do kalibracji na próbce.
- Ponowne kodowanie obrazu (bez metadanych, WebP 600×900) w usłudze klasyfikatora (Pillow), bez nowego pakietu npm.
- Brak werdyktu: okładka zapisana jako `pending` (niewidoczna), ponowienia po 5 min, 30 min i 24 h od uploadu, potem usunięcie. Ponowienia leniwie: pierwsze żądanie czytające folder po terminie wykonuje próbę w `after()`; próbę przejmuje atomowo jedno żądanie.
- Odrzucenie po nieudanych próbach: folder zapamiętuje odrzucenie, strona folderu pokazuje komunikat do czasu nowego uploadu albo zamknięcia komunikatu.
- Implementacja: kolekcja `covers` (`data`, `size`, `state: pending | rated`, `scores`, `model`, `autoAdult`, `manualAdult`, `attempts`, `nextAttemptAt`, `userId`), w folderze `coverId` (okładka z werdyktem) i `coverRejectedAt`. Nowy upload usuwa wcześniejszą okładkę `pending` folderu; poprzednia z werdyktem zostaje do chwili oceny nowej. `autoAdult` ustawia `adult.auto` folderu (blokada z D67), usunięcie okładki je zeruje.
- Akcje w `folders/[id]/cover-actions.ts`, dialog „Okładka” w menu ⋮ nagłówka folderu (tylko z `TOOLS_API_URL`): kadr 2:3 z przeciąganiem i powiększeniem, WebP 600×900 z canvasu (JPEG, gdy przeglądarka nie koduje WebP), ręczne oznaczenie okładki jako 18+, usunięcie. Akcja przyjmuje WebP, JPEG lub PNG do 1 MB po bajtach.
- `GET /covers/<id>`: tylko okładka z werdyktem i aktualna w folderze; właściciel zawsze (`private`), inni tylko dla opublikowanego folderu (`public`), oba `max-age=31536000, immutable`.
- Eksport: `cover.webp` w zipie folderu; w `.epub`, `.docx` i `.pdf` przeglądarka zamienia okładkę na JPEG (biblioteki DOCX i PDF nie przyjmują WebP) i wstawia ją jako pierwszą stronę. Import zipa z `cover.webp` wysyła okładkę (przez ten sam filtr) tylko do nowo tworzonego folderu; błąd okładki nie przerywa importu.

## D69 – Wyświetlanie okładek (2026-11-09)

- Task 40 (subtask 66), decyzje użytkownika. Okładka folderu jest widoczna na liście folderów (`/stories`, miniatura 40×60), na stronie folderu właściciela (120×180), w publicznym spisie folderu (160×240), na każdej publicznej stronie rozdziału (120×180, między tytułem a treścią), w publicznej wyszukiwarce i w „Ostatnio opublikowanych” na stronie głównej (miniatura przy wyniku). Nie ma jej w edytorze. Folder bez okładki nie renderuje obrazka.
- Okładka 18+ (ocena filtra albo ręczne oznaczenie właściciela) na publicznych listach jest zastąpiona polem ze znaczkiem 18+, a w publicznym spisie i na stronie rozdziału jest rozmyta z przyciskiem „Pokaż okładkę (mam ukończone 18 lat)”. Przycisk ustawia to samo cookie co ostrzeżenie przed rozdziałem (D67), więc potwierdzenie działa w obie strony. Właściciel widzi swoje okładki zawsze bez rozmycia.
- Adres `/covers/<id>` zmienia się przy każdej wymianie okładki, więc nowa okładka pokazuje się od razu mimo `immutable`.

## D70 – Branch `security` i aktualizacja zależności (2026-11-09)

- Poprawki bezpieczeństwa (taski 56–63, aktualizacja zależności z 2026-11-09) idą na lokalny branch zbiorczy `security` z `develop`; branche tasków z niego. `security` nie jest pushowany, a do `develop` merguje go użytkownik po przeglądzie (decyzja użytkownika).
- Aktualizacja zależności łącznie z majorami, każdy osobno (decyzja użytkownika). TypeScript zostaje na 6.x: `typescript-eslint` nie obsługuje jeszcze TS 7. `@types/node` na 24.x (D34).

## D71 – Typy argumentów Server Actions (2026-11-09)

- Task 61, decyzje użytkownika: własne guardy w `lib/action-input.ts` (`isString`, `isBoolean`, `isId`, `isIsoDate`) na początku akcji, bez `zod`.
- Argument złego typu zwraca `INVALID_INPUT` z komunikatem `requestInvalid` (albo istniejącym komunikatem akcji, np. `coverInvalid`, `detailsInvalid`). ID złego typu (nie string z 24 znakami hex) to `NOT_FOUND`, jak nieistniejące ID (D1); `isId` zastępuje w akcjach `isObjectIdOrHexString`, które przepuszcza obiekt z `_bsontype`.
- `expectedUpdatedAt` i `expectedNotesUpdatedAt` muszą być dokładnie w formacie `toISOString()`, który wysyła serwer.

## D72 – Limity rozmiaru i liczby danych (2026-11-10)

- Taski 59 i 62, decyzje użytkownika. Wartości w `lib/limits.ts`: nazwa folderu i tytuł rozdziału do 200 znaków (jak tytuł w imporcie), treść rozdziału do 500 000 znaków, notatki rozdziału i folderu do 100 000 znaków. Znaki to `String.length` zapisywanego markdownu, tak samo w przeglądarce i w akcji.
- Liczby: 1000 folderów na konto (bez usuniętych), 500 rozdziałów w folderze (jak limit rozdziałów importu), 100 wersji folderu. Przy limicie wersji zapis jest blokowany z komunikatem „Usuń starą wersję…”; nic nie znika samo. Przywracanie wersji też go wymaga, bo najpierw zapisuje stan folderu jako wersję. Liczby sprawdzane przed zapisem, więc równoległe żądania mogą je minimalnie przekroczyć (to ochrona bazy, a nie dokładny limit).
- Import: rozdział dłuższy niż 500 000 znaków albo z za długimi notatkami odrzuca cały import z komunikatem, który podaje tytuł rozdziału. Notatki folderu dopisywane do istniejących też muszą zmieścić się w limicie. `MAX_IMPORT_TEXT_BYTES` (3,5 MB na cały plik) zostaje.
- Istniejące dane ponad limit da się otworzyć; zapis jest odrzucany, dopóki wartość jest ponad limitem, więc wystarczy ją skrócić.
- UI: `maxLength` w polach nazw i tytułów. Edytor treści i notatek (Tiptap) nie ma `maxLength`, więc przy przekroczeniu pod treścią pojawia się komunikat, a zapis i autozapis nie wysyłają żądania i pokazują komunikat w statusie. Tekst zostaje w edytorze.

## D73 – Zapis dużej treści a dekoder React Flight (2026-11-10)

- Task 62. Przyczyna F8: dekoder argumentów Server Actions w React (`decodeReply`) sumuje długości napisów (jednostki UTF-16, nie bajty) leżących bezpośrednio w tablicy argumentów i odrzuca żądanie powyżej `arraySizeLimit` = 1 000 000 („Maximum array nesting exceeded”). Next.js 16.4.6 nie pozwala zmienić tej wartości. Aktualizacja z taska 56 (React 19.3.1) nie zmieniła progu. Import przechodzi, bo jego napisy leżą w obiektach.
- Limit z D72 (treść 500 000 + notatki 100 000 + tytuł 200, a w `saveStory` także obiekt korekty) daje najwyżej ok. 600 300, czyli zapas ok. 400 000 do progu (pomiar: `encodeReply` → `decodeReply`, także z maksymalną korektą i polskimi znakami).
- Edytor nie wysyła treści ponad limitem: pokazuje komunikat pod treścią i w statusie zapisu, a tekst zostaje (także przy autozapisie). Żądanie spreparowane ręcznie (500 000–~1 000 000) dostaje `INVALID_INPUT`. Powyżej 1 000 000 dalej jest 500 z dekodera, zanim akcja ruszy, i aplikacja nie ma na to wpływu. Wymaga to sesji i nie zmienia danych.

## D74 – Zaufany adres klienta w limitach (2026-11-10)

- Task 57, decyzje użytkownika. Na Vercelu adres klienta pochodzi tylko z `x-vercel-forwarded-for` (ustawia go platforma; według dokumentacji Vercela nadpisuje też `X-Forwarded-For`, ale ten nagłówek może zmienić proxy przed Vercelem). `X-Forwarded-For` jest ignorowany. Przy przeprowadzce poza Vercela zmienna `TRUSTED_IP_HEADER` wskazuje nagłówek proxy (używają jej też testy E2E). Pusta wartość nie wyłącza nagłówka Vercela.
- Bez zaufanego adresu (lokalnie, w testach, źle skonfigurowany hosting) limity po adresie są wyłączone, a w produkcji przy pierwszym takim żądaniu idzie ostrzeżenie do logów. Wspólny kubełek „unknown”, który pozwalał jednej osobie zablokować wszystkim logowanie, zniknął. Rejestracja i wyszukiwarka nie mają wtedy limitu.
- Limit logowania po koncie: 20 błędnych prób na godzinę na nick (bez rozróżniania wielkości liter), z dowolnych adresów, liczony także dla nicków bez konta (bez enumeracji). Po przekroczeniu blokuje także poprawne hasło do końca okna (najwyżej godzinę). Udane logowanie oddaje próbę.
- I1: rejestracja liczy limit przed sprawdzeniem, czy nick jest zajęty, więc zajęty nick też zużywa próbę (5 na godzinę z adresu). Komunikat „Za dużo prób rejestracji”. Próby odrzucone przez walidację nicku i hasła się nie liczą.

## D75 – Unieważnianie sesji i słabe hasła (2026-11-10)

- Task 58, decyzje użytkownika. Każde logowanie zapisuje sesję w kolekcji `sessions` (losowe `_id`, `userId`, `expiresAt` z indeksem TTL), a JWT niesie jej `sid`. Callback `jwt` przy każdym `auth()` sprawdza, czy sesja istnieje; jeśli nie, zwraca `null` i Auth.js czyści cookie. Tokeny sprzed D75 nie mają `sid`, więc po wdrożeniu każdy loguje się raz ponownie.
- Wylogowanie (`events.signOut`) usuwa sesję, więc skopiowane cookie przestaje działać. Zmiana hasła usuwa wszystkie inne sesje użytkownika, a bieżąca zostaje. Przycisk „Wyloguj inne urządzenia” w ustawieniach (z potwierdzeniem) robi to samo bez zmiany hasła. Bez listy sesji. `maxAge` zostaje 30 dni; `expiresAt` sesji przesuwa się razem z odnawianym JWT najwyżej raz na dobę.
- Koszt: jeden odczyt sesji po `_id` na `auth()`, z cache pozytywnych wyników w pamięci procesu na 10 s. Usunięcie sesji czyści cache w tym samym bundlu. Inna instancja serwera, a także proxy (osobny bundle), mogą przez te 10 s uznawać sesję za ważną. Strony i akcje i tak sprawdzają `requireUser()`/`auth()` w bundlu aplikacji, więc po unieważnieniu chroniona strona przekierowuje na stronę główną.
- `sid` jest też w obiekcie sesji (`/api/auth/session`), żeby akcje wiedziały, której sesji nie usuwać. Sam `sid` bez podpisanego cookie nic nie daje.
- Limit `changePassword`: 5 błędnych obecnych haseł na 15 min na użytkownika (`RATE_LIMITED`), także dla poprawnego hasła po przekroczeniu. Udana zmiana oddaje próbę, a nowe hasło odrzucone przez walidację się nie liczy.
- I5 (decyzja użytkownika: reguły bez listy): `passwordError` odrzuca hasło, w którym jeden znak stanowi co najmniej połowę znaków, hasło z ciągiem 6 kolejnych znaków alfabetu, cyfr albo rzędu klawiatury (`abcdef`, `123456`, `qwerty`, `asdfgh`, także wstecz) oraz hasło zawierające nick (bez rozróżniania wielkości liter). Działa przy rejestracji, zmianie hasła i w `create-account`; nie dotyczy logowania istniejących kont.

## D76 – Kody odzyskiwania konta (2026-11-10)

- Task 63, decyzje użytkownika. 10 kodów w formacie `XXXX-XXXX-XXXX` z alfabetu base32 Crockforda (bez I, L, O, U; ok. 60 bitów na kod). W bazie (`User.recoveryCodes: { hash, usedAt }[]`) tylko HMAC-SHA-256 z kluczem wyprowadzonym z `AUTH_SECRET`; jawnych kodów nigdzie nie ma. Zmiana `AUTH_SECRET` unieważnia wszystkie kody. Przy wpisywaniu wielkość liter, spacje i myślniki nie mają znaczenia, a O, I i L czytane są jako 0 i 1.
- Kody dostaje się tylko przy rejestracji: okno pokazuje je raz i nie daje się zamknąć, dopóki użytkownik nie zaznaczy „Mam zapisane te kody”. Konta sprzed taska nie mają kodów i nie ma migracji (brak pola = brak kodów). W ustawieniach nie ma regeneracji.
- „Nie pamiętasz hasła?” w oknie logowania: nick, kod, nowe hasło (pełna walidacja `passwordError` z nickiem, D75). Udany reset ustawia hasło, unieważnia użyty kod i zastępuje cały zestaw 10 nowymi kodami, które pokazuje raz (tak jak po rejestracji). Kończy wszystkie sesje konta (D75) i loguje na tym urządzeniu. Kod jest jednorazowy także przy równoległych żądaniach (warunek w filtrze aktualizacji). Pole `usedAt` zostaje na przyszłe 2FA.
- Ochrona: stały czas odpowiedzi 1,5 s (jak logowanie). Błędny kod, użyty kod, nieistniejący nick i konto bez kodów dają ten sam komunikat. Limity: 5 błędnych prób na godzinę na nick (także nieistniejący) i 20 na 15 min z adresu (D74). Udany reset oddaje próby.

## D77 – Nagłówki bezpieczeństwa i CSP (2026-11-10)

- Task 60, decyzje użytkownika: CSP z nonce generowanym w `proxy.ts` przy każdym żądaniu (wszystkie strony i tak renderują się dynamicznie; statyczny jest tylko `app/not-found.tsx` bez skryptów) i HSTS ustawiany przez aplikację, bez `preload`.
- Polityka (`lib/security-headers.ts`): `script-src 'self' 'nonce-…' 'strict-dynamic' 'wasm-unsafe-eval'` (w dev także `'unsafe-eval'`), `style-src 'self' 'unsafe-inline'` (atrybuty `style` edytora i Radix nie mogą mieć nonce), `img-src 'self' blob: data:`, `font-src 'self' data:`, `connect-src 'self'` (w dev także `ws:`), `worker-src 'self' blob:`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Next.js bierze nonce z nagłówka CSP żądania; skrypt motywu (`InlineScript`) dostaje go z `x-nonce`. `next-intl` przekazuje dalej nagłówki żądania, które dostaje.
- `'wasm-unsafe-eval'` tylko dla pdf.js w imporcie PDF (bez niego pdf.js przechodzi na wolniejszy JavaScript). `eval` jest zablokowany: polyfille w bundlu czytnika `.docx` próbują `Function()` w `try/catch` i bez tego działają.
- Nagłówki stałe z `next.config.ts` dla każdej odpowiedzi: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (bez kamery, mikrofonu, lokalizacji, płatności, USB i Topics), `Strict-Transport-Security: max-age=63072000; includeSubDomains`. `poweredByHeader: false`.
- Testy E2E: fixture `context` w `tests/e2e/helpers.ts` zapisuje każde zdarzenie `securitypolicyviolation` i oblewa test, jeśli jakieś wystąpiło. Wyjątki tylko jawnie przez `allowCspViolation` z uzasadnieniem: parsowanie wklejonego HTML w nieaktywnym dokumencie zgłasza `script-src-attr`, choć handler i bez CSP by się nie wykonał (sprawdzone w Chromium), oraz próba `Function()` w imporcie `.docx`.
