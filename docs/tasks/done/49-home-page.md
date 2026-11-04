# 49 – Przebudowa strony głównej

Zgłoszenie użytkownika (2026-11-03). Ustalenia z burzy mózgów 2026-11-04; na starcie implementacji trafiają do `docs/decisions.md` jako nowa decyzja (zmienia D38 i D42).

## Stan obecny

- Niezalogowany: publiczna wyszukiwarka opublikowanych opowiadań (task 39, D42) i przycisk „Log in / Create account” otwierający dialog logowania.
- Zalogowany: ta sama wyszukiwarka w układzie aplikacji z sidebarem (pozycje Home i Search prowadzą na tę samą stronę).
- Rozdziały nie mają daty publikacji; wyszukiwarka sortuje po `updatedAt`.

## Ustalenia

- Strona `/` zostaje jedną stroną dla obu stanów, wyszukiwarka zostaje na `/` (bez `/search`).
- Kolejność sekcji (jedna kolumna): hero (tylko gość), wyszukiwarka z tagami, wyniki (gdy jest zapytanie lub tag), „Ostatnio opublikowane” (zawsze, także przy wynikach).
- Zalogowany widzi to samo bez hero, w układzie z sidebarem.
- Logowanie i rejestracja bez zmian: dialog z D42 (`?auth=login`, `callbackUrl`). Otwiera go przycisk w prawym górnym rogu i przyciski CTA w hero.
- Sidebar: pozycja Search usunięta, zostaje Home.
- „Ostatnio opublikowane”: rozdziały (ten sam wygląd pozycji co w wynikach: tytuł, folder, autor, tagi, początek tekstu po `stripComments`), sortowane po nowym polu `publishedAt` malejąco (remis: `_id` malejąco, czyli nowszy rozdział wyżej). Serwer pobiera 15, klient pokazuje 5 i przycisk „Show more” dokłada po 5, do 15; przy 15 albo gdy nie ma więcej, przycisk znika. Pusta lista: komunikat zamiast sekcji. Te same warunki widoczności co wyszukiwarka (publiczny rozdział w opublikowanym folderze, autor z nickiem). Lista nie zużywa limitu `SEARCH_LIMIT`.
- Data przy pozycji: w ostatnich 7 dniach względna („3 days ago” / „3 dni temu”), starsza jako data w języku interfejsu („Nov 4, 2026” / „4 lis 2026”). Formatowanie na serwerze (next-intl), do klienta trafia gotowy tekst, żeby nie było różnic przy hydratacji.

### `publishedAt`

- Nowe pole `stories.publishedAt` (Date, opcjonalne): moment pierwszej publikacji rozdziału. Ustawiane raz, nigdy nie zmieniane ani nie usuwane (decyzja użytkownika po zamknięciu taska, zastępuje „każda publikacja od nowa” i `$unset` przy ukryciu).
- Ustawiane, gdy rozdział staje się publiczny i jeszcze go nie ma: `setFolderPublished(id, true)` na nieopublikowanym folderze, `publishAllChapters`, Publish rozdziału. Unpublish, przeniesienie i przywrócenie z wersji go nie ruszają. Import i nowy rozdział pola nie dostają.
- Zapisy nie zmieniają `updatedAt` (`timestamps: false`, jak `publication`): edytor wysyła `updatedAt` jako wersję oczekiwaną przy zapisie, więc zmiana dawałaby konflikt w otwartym edytorze (decyzja użytkownika przy implementacji).
- Migracja `006-published-at.ts`: rozdziały widoczne dziś publicznie dostają datę uruchomienia migracji (jedna wspólna wartość, kolejność rozstrzyga `_id`). Expand-only (D14).
- Indeks `{ publication: 1, publishedAt: -1 }`, zakładany przez `syncIndexes()`.

### SEO

- `metadata.title` strony głównej: „Story App – write and publish stories” / „Story App – pisz i publikuj opowiadania”; do tego `description` z opisu hero. `hreflang` bez zmian (z task 43).
- Nagłówki: u gościa `h1` to nagłówek hero, a „Search stories” to `h2`; u zalogowanego „Search stories” zostaje `h1`. „Recently published” to zawsze `h2`.

### Teksty

Hero od razu zapowiada słownik i korektę, choć przychodzą dopiero z taskami 23–35 (decyzja użytkownika).

| Klucz | EN | PL |
| --- | --- | --- |
| hero – nagłówek | Your stories, from the first line to the first reader | Twoje opowiadania od pierwszego zdania do pierwszego czytelnika |
| hero – opis | Write chapter by chapter with definitions, synonyms, rhymes and proofreading at hand. Go back to any earlier version whenever you like. When your text is ready, publish it with a single click. | Pisz rozdział po rozdziale, mając pod ręką definicje, synonimy, rymy i korektę. Do wcześniejszych wersji wrócisz w każdej chwili. Gdy tekst będzie gotowy, opublikujesz go jednym kliknięciem. |
| hero – CTA główne | Create account | Załóż konto |
| hero – CTA drugie | Log in | Zaloguj się |
| sekcja | Recently published | Ostatnio opublikowane |
| przycisk | Show more | Pokaż więcej |
| pusta lista | Nothing has been published yet. | Nic jeszcze nie opublikowano. |

CTA główne otwiera dialog w trybie rejestracji, drugie w trybie logowania (jeśli dialog nie przyjmuje dziś trybu startowego, dodajemy go, np. `?auth=register`). Przycisk „Log in / Create account” w prawym górnym rogu zostaje.

## Zakres

- Hero gościa, sekcja „Recently published” z „Show more”, usunięcie Search z sidebara, nowe `metadata`.
- Pole `publishedAt`, ustawianie w trzech akcjach publikacji, migracja i indeks.
- Zapytanie listy w `lib/publish/queries.ts` (reużycie `findSearchableFolders` / `buildPublicFilter`).
- Teksty w `messages/en.json` i `messages/pl.json`; działanie pod obydwoma prefiksami języka; wygląd zgodny z trybem jasnym, ciemnym i paletami akcentów (task 48).
- Hero, wyszukiwarka i lista dopracowane także pod wąski ekran (decyzja użytkownika; reszta mobile zostaje w tasku 51).
- `README.md`: bez zmian (opis domenowy już pasuje).

## Kryteria akceptacji

1. Gość na `/en` i `/pl` widzi hero z nagłówkiem, opisem i dwoma CTA; zalogowany nie widzi hero.
2. „Create account” otwiera dialog w trybie rejestracji, „Log in” w trybie logowania; `?auth=login` i `callbackUrl` działają jak dotąd.
3. Wyszukiwarka działa na `/` jak dotąd (zapytanie, tagi, limit), a „Recently published” jest widoczne pod wynikami także w trakcie wyszukiwania.
4. „Recently published” pokazuje 5 najnowszych po `publishedAt`; „Show more” dokłada po 5 do 15, potem znika; przy mniej niż 6 pozycjach przycisku nie ma; pusta lista pokazuje komunikat.
5. Lista nie pokazuje rozdziałów ukrytych, z nieopublikowanych lub usuniętych folderów, usuniętych rozdziałów ani autorów bez nicku.
6. Publish folderu, Publish rozdziału i Publish all ustawiają `publishedAt` rozdziałom, które go jeszcze nie mają; Unpublish, ponowna publikacja, przeniesienie i przywrócenie z wersji zachowują datę; `updatedAt` się nie zmienia.
7. Migracja ustawia jedną datę rozdziałom widocznym publicznie i nie rusza pozostałych; ponowne uruchomienie nic nie zmienia.
8. Data przy pozycji: względna do 7 dni, starsza jako data, w języku interfejsu.
9. Sidebar nie ma pozycji Search; Home prowadzi na `/`.
10. Tytuł i opis strony w obu językach zgodne z sekcją SEO.
11. Hero, wyszukiwarka i lista bez poziomego przewijania i z czytelnym układem na szerokości 375 px.

## Testy

- Unit: funkcja formatująca datę (granica 7 dni, oba języki).
- Integracyjne: zapytanie listy (kolejność, limit 15, filtry widoczności z kryterium 5); akcje publikacji i `publishedAt` (kryterium 6); migracja (kryterium 7).
- E2E: hero gościa i brak hero u zalogowanego, CTA otwierające dialog w dobrym trybie, „Show more” (kryteria 1–4, 8 w podstawowym przypadku); sidebar bez Search (9); tytuł strony (10); brak poziomego przewijania przy viewport 375 px (11, wygląd `manual`). Istniejące testy E2E `search`, `auth`, `layout` poprawione do nowego układu.
