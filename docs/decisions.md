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
- Kolory w komponentach tylko przez zmienne z `app/globals.css`, także podświetlenia wyszukiwania (`highlight`, `highlight-current`), komentarze (`comment`, `comment-border`) i diff wersji (`diff-added`, `diff-removed`). Wyjątek: przyciemnienie tła pod dialogiem (`bg-black/10`), bo to cień, nie kolor tekstu ani tła treści.
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
