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

- Odstępstwo od „tylko desktop” w spec: edytor obsługuje wąskie ekrany. Poniżej breakpointu `md` (768 px) na górze jest przełącznik Story / Notes / Chapters (`role="tablist"`, nazwa „View”) i widoczny jest jeden panel naraz. Zakładka Story pokazuje edytor WYSIWYG (D20); Notes – notatki folderu nad notatkami rozdziału, bez separatora.
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

## D19 – Panele edytora (2026-10-20)

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

## D27 – Pozycja przewijania przy przełączaniu widoków (2026-10-30)

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

- Dotyczy każdego `MarkdownEditor`: treści, notatek rozdziału i notatek folderu. Odstęp nad pierwszą i pod ostatnią linią to wysokość widoku minus jedna linia (`--scroll-gap`, liczone w `trackScrollGap`, `ResizeObserver` na elemencie przewijanym). Wysokość linii pochodzi z pola, więc dłuższy nagłówek jako ostatnia linia jest przy maksymalnym przewinięciu widoczny częściowo.
- Po otwarciu `scrollTop` to 0, czyli pierwsza linia stoi przy dolnej krawędzi. To decyzja użytkownika, tak samo nad tekstem w notatkach i przy zapamiętanej pozycji „na początku” (D27).
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

