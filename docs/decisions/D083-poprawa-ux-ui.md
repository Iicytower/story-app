# D83 – Poprawa UX i UI (2026-11-12)

Status: aktualna. Zmienia D16, D17, D18, D25, D27, D30, D31, D33, D42, D47, D50, D54 oraz części D80 `navigation.md`, `text-interactions.md`, `stats-discovery.md`.

- Task zbiorczy 51, subtaski 93–107, decyzje użytkownika z 2026-11-12 na podstawie raportu [`docs/ui-ux-report.md`](../ui-ux-report.md) (ocena 6/10, zrzuty w `docs/ui-ux-report/`). Numery w nawiasach (np. 3.1) to punkty raportu. Priorytet: funkcjonalność i wygoda, potem spójność, potem estetyka; prostota, mało animacji.

## Przebieg i branche

- Branch zbiorczy `fix/ui` z `feature/social`, lokalny, niepushowany. Subtaski: `feature/NN-<slug>` z aktualnego `fix/ui`, jeden commit `NN: <opis>`, merge `--no-ff` do `fix/ui`. `fix/ui` do `feature/social`/`develop` merguje użytkownik.
- Przebieg bez nadzoru: `/autorun 51`, w nocy przez `scripts/autorun-night.sh 51` (`claude -p` z `--permission-mode auto --permission-prompts none`, wznawianie tej samej sesji po limicie, opis w `README.md`). Rozstrzygnięcia Claude'a z przebiegu w sekcji „Rozstrzygnięcia Claude'a do potwierdzenia” na końcu tego pliku.
- Bez nowych pakietów npm. Nowe komponenty shadcn (np. `tabs`, `avatar`, `skeleton`, `badge`) wolno dodać do `components/ui`, jeśli korzystają tylko z zainstalowanego `radix-ui`: źródło z MCP `shadcn` (`view_items_in_registries`), importy z `radix-ui`, zapis plikiem. Nie przez `npx shadcn add`, jeśli ten chce instalować zależności (`autorun-guard.sh` blokuje instalację). Czas względny przez `Intl.RelativeTimeFormat`.
- `ui-checker` używa Playwright MCP (`mcp__playwright__*`) i sprawdza każdy subtask zmieniający UI: dwa warianty (1280 jasny `/en`, 375 ciemny `/pl`). Audyt końcowy (107): wszystkie 8 wariantów i obszary niesprawdzone w raporcie; wynik w `docs/ui-ux-report-after.md` ze zrzutami w `docs/ui-ux-report-after/`, ten sam format i ocena 0–10.
- Testy: każdy subtask aktualizuje E2E i helpery, które psuje (selektory, adresy, teksty), w tym samym tasku.

## Nazewnictwo i adresy (93)

- W UI kontener to „Książka” / „Book”, element to „Rozdział” / „Chapter” (pl: Książki, Nowa książka, Nowy rozdział; en: Books, New book, New chapter). Dotyczy wszystkich wartości w `messages/*.json`, tytułów stron i metadanych, także stron publicznych. Klucze w `messages/*.json` (np. `folders.*`), modele (`Folder`, `Story`), kolekcje i nazwy w kodzie bez zmian. Zmienia D16 tylko w warstwie UI.
- Nowe adresy prywatne, bez przekierowań (na produkcji nie ma jeszcze danych użytkowników): `/books` (lista, dawne `/stories`), `/books/[id]` (dawne `/folders/[id]`), `/chapters/[id]` (edytor, dawne `/stories/[id]`). Route Handlery eksportu: `/books/[id]/export…` i `/chapters/[id]/export…` (dawne `/folders/[id]/export…`, `/stories/[id]/export…`). Stare adresy kończą się 404. Adresy publiczne `/p/<nick>/<książka>/<rozdział>` bez zmian.

## Daty (94)

- Każda data z godziną przez `LocalDate` (strefa przeglądarki), także feed, statystyki, moderacja, admin, fora, komentarze, notatka o banie (8.1). Daty bez godziny mogą zostać w UTC.
- Powiadomienia i lista wiadomości: czas względny („2 godz. temu”, pełna data w `title`) i grupy „Dzisiaj” / „Wcześniej” w powiadomieniach (6.5).

## Nawigacja i układ (95, 96)

- Na górze sidebara nazwa aplikacji (link do `/`). Na dole zamiast pozycji „Ustawienia” blok konta: avatar i nick, menu: „Mój profil”, „Ustawienia”, „Wyloguj”. Wylogowanie znika z dialogu ustawień (zmienia D50). Gość: bez zmian poza nazwą aplikacji.
- „Feed” po polsku „Aktualności”. „Moderacja” na dole listy, nad blokiem konta. Licznik nieprzeczytanych przy „Wiadomości” (104) i oczekujących zgłoszeń przy „Moderacja” (106).
- Mobile: cienki pasek u góry z hamburgerem i nazwą aplikacji (2.4).
- Dialogi bez `backdrop-blur`, samo przyciemnienie (1.5).
- Dwa warianty szerokości treści (1.4): wąski (listy, czytanie, formularze; `max-w-3xl`) i szeroki (tabele, książka, statystyki; `max-w-5xl`), wspólny komponent kontenera używany na wszystkich stronach.
- Zalogowany widzi sidebar na wszystkich stronach `/p/...` (1.3); gość bez zmian.

## Książki, rozdziały, wersje (97, 98)

- Widoczny przycisk główny „Nowa książka” na liście i „Nowy rozdział” w książce; w menu ⋮ zostają akcje rzadkie (3.2).
- Tryb `created` sortuje rozdziały od najstarszego (`createdAt` rosnąco, remis `_id` rosnąco) – dotyczy listy, panelu Chapters, eksportu, wersji i strony publicznej (wspólne `chapterOrder`). Wartość `created` zostaje, więc wszystkie istniejące książki w tym trybie zmieniają kolejność bez migracji danych (zmienia D17).
- Na liście rozdziałów tylko tagi różne od tagów książki (3.4). Status publikacji jako etykieta tekstowa „Publiczny” / „Niepubliczny” zamiast samej ikony (3.5). Link publiczny jako kompaktowy wiersz „Publiczny · Kopiuj link · Otwórz” bez pola z URL, w książce i w edytorze (3.6). Szkielety o stałej wysokości tam, gdzie elementy doładowują się po hydratacji (3.9).
- Nowe pole `folders.description` (opis książki, zwykły tekst, do 1000 znaków w `lib/limits.ts`, D72), edycja na stronie książki, widoczny na publicznej stronie książki i w wynikach wyszukiwarki; `npm run seed` wypełnia opisy.
- Wersje (3.8): „Przywróć całą wersję” nieaktywny, gdy żaden rozdział się nie różni; styl drugorzędny i `AlertDialog` z potwierdzeniem; klikalny cały wiersz checkboxa.

## Edytor (99)

- Górny odstęp przewijania (`TOP_GAP`) zmniejszony do dwóch wysokości linii, także w notatkach (4.1, 3.7); dolny odstęp bez zmian (zmienia D30 i pozycję „na początku” z D27).
- Układ mobile/desktop bez przeskoku po hydratacji: przełączanie w CSS albo oba warianty ukryte do hydratacji (4.2).
- Pasek narzędzi notatek (rozdziału i książki) widoczny tylko, gdy pole ma fokus; pasek treści bez zmian (4.3).
- Tryby edytora: „Tekst” / „Markdown” (en: „Text” / „Markdown”) zamiast „Podgląd” / „Źródło” (4.4).
- Sidebar aplikacji zwinięty domyślnie na stronie edytora; ręczne rozwinięcie zapamiętane jak dotychczasowy stan sidebara (4.5).
- Stały, cichy status „Zapisano” w stopce obok licznika słów, bez animacji (4.6). Margines kart w panelu Narzędzia (4.7).

## Strona główna (100)

- Zalogowany: na górze wiersz „Ostatnio edytowane: <rozdział> → Kontynuuj” (link do edytora) i przycisk „Nowa książka” (2.1).
- Sekcja „Popularne w kategoriach” usunięta, kategorie jako filtr chipów nad listą; sekcja „Od obserwowanych” usunięta, bo dubluje Aktualności (2.2, zmienia D54 i D80 `stats-discovery.md`). Kod i zapytania, które zostają bez użycia, usunięte.
- Wyszukiwarka: przycisk z ikoną lupy, krótszy placeholder („Szukaj opowiadań”), etykiety „Kategorie” / „Tagi” (2.3). Mobile: data w linii z autorem (2.4).

## Ustawienia, profil, biblioteka, statystyki (101, 102)

- Dialog ustawień z zakładkami (po lewej, na mobile u góry): Wygląd, Profil, Konto, Powiadomienia (7.1, zmienia D50). Dialog można otworzyć na wybranej zakładce.
- Na własnym profilu przycisk „Edytuj profil” otwierający zakładkę Profil; jedna nazwa „O mnie” (6.6).
- „Biblioteka publiczna” przeniesiona do „Zarządzaj półkami” (5.1).
- Statystyki: wykres bez animacji (`isAnimationActive={false}`), szkielet o stałej wysokości, opis „Książki i rozdziały” w jednym zdaniu (5.3).

## Społeczność (103, 104, 105)

- Reakcje: widoczne tylko użyte, z licznikami, i jeden przycisk „Dodaj reakcję” z wyborem; łączny licznik usunięty (6.3, zmienia D80 `text-interactions.md`).
- Fora: pod nazwą kategorii linia meta (liczba wątków, ostatnia aktywność) (6.1); formularz nowego wątku za przyciskiem „Nowy wątek” (6.2).
- Wiadomości: podgląd ostatniej wiadomości i wyróżnienie nieprzeczytanych (6.4), licznik w sidebarze. Aktualności: jeden wyróżniony link na wpis (tytuł rozdziału), reszta bez podkreślenia (5.2).
- Strona książki: „Czytaj dalej” jako przycisk główny, średnia jako liczba, gwiazdki tylko jako „Twoja ocena”, okładka i opis (6.7). Obie oceny (książki i rozdziału) zostają.
- Rozdział publiczny: nawigacja „Następny rozdział →” bezpośrednio pod tekstem, potem reakcje, ocena rozdziału, zgłoszenie; pasek zakładek z ramką zamiast cienia (6.8).

## Moderacja i admin (106)

- Licznik oczekujących zgłoszeń przy zakładce i w sidebarze (7.2). Ban globalny jako przycisk w stylu destrukcyjnym; etykieta „Zgłoszony profil: <nick>” (7.3).

## Rozstrzygnięcia Claude'a do potwierdzenia

- 93: pliki tras: lista i akcje folderów (`actions.ts`, `create-folder-dialog.tsx`, `folder-row-menu.tsx`, `stories-menu.tsx`, `import-dialog.tsx`) w `app/[locale]/(protected)/books/`, akcje i dialogi rozdziałów (`actions.ts`, `create-story-dialog.tsx`, `delete-story-dialog.tsx`) w `chapters/`; nazwy komponentów i funkcji bez zmian.
- 93: zakładka edytora na wąskim ekranie `editor.views.story` to „Tekst” / „Text”, żeby „Rozdział” nie mylił się z panelem „Rozdziały”.
- 93: „opowiadania” zostają tylko w publicznej wyszukiwarce (`search.title`, `search.label`, `search.none`, wyjątek z D83); hero, tytuł strony głównej i pusty feed mówią „książki”. Po angielsku „stories” zostaje w ogólnym znaczeniu (hero, tytuł strony głównej, wyszukiwarka publiczna). Wyszukiwarka na `/books`: „Szukaj w książkach” / „Search books”. Test słowników: `i18n/messages.test.ts` („naming (D83)”).
- 93: pole i błędy mówią „nazwa książki” (nie „tytuł”), jak pole „Nazwa” w dialogach.
- 93: import rozpoznaje też dawne nagłówki „Folder notes” / „Notatki folderu” (`FOLDER_NOTES_HEADINGS`), żeby pliki wyeksportowane przed zmianą wracały z notatkami książki.
- 93: starsze decyzje opisujące adresy (D18, D25, D31, D33, D47; D16 już wcześniej) dostały „Zmieniona w D83 (adresy)”, treści nie przepisano (D82); `docs/spec.md` bez zmian. Ścieżki w skryptach `docs/security/exploits/` zmienione na nowe.
- 93: powiadomienia nie prowadzą pod adresy prywatne (tylko strony publiczne, wiadomości, profil, moderacja); `routes.spec.ts` sprawdza przejście z powiadomienia o komentarzu.
- 94: czas względny w długiej formie `Intl.RelativeTimeFormat` („2 godziny temu”, „5 minutes ago”), jak dotychczasowe daty na stronie głównej, feedzie, forach i w komentarzach; po tygodniu data bez godziny. `LocalDate relative` odświeża tekst co 30 s; pełna data z godziną (lokalna strefa) w `title`. Feed, fora i komentarze też dostały `LocalDate relative` (wcześniej `title` w UTC).
- 94: etykiety przycisków z datą (`resolveFor`, `dismissFor`, `hideFor`, `banFor`, `menuFor`, `moderateFor`, `restorePost`) są tekstem (`aria-label`), więc zostają formatowane na serwerze (UTC lub czas względny); widoczne daty w moderacji, adminie i notatce o banie idą przez tag `<date></date>` w `t.rich` (`components/local-date-tag.tsx`).
- 94: statystyki (`stats/page.tsx`) i strona główna (`published-date.ts` na serwerze) zostają w UTC: dni statystyk to dni UTC, a data na stronie głównej nie ma godziny.
- 94: nie ma osobnej strony powiadomień, czas względny i grupy „Dzisiaj” / „Wcześniej” są w panelu; panel to grupa „Powiadomienia” z listą pod każdym nagłówkiem. W wątku wiadomości godziny zostają bezwzględne (czas względny tylko na liście rozmów).
- 95: „Mój profil” zostaje też na liście sidebara (D83 zastępuje blokiem konta tylko „Ustawienia”), menu konta go powtarza. Admin i Statystyki zostają na swoich miejscach; „Moderacja” w dolnej grupie nad blokiem konta, z miejscem na licznik (`pendingModeration`, wypełnia 106).
- 95: przycisk bloku konta nazywa się „Menu konta, <nick>” / „Account menu, <nick>” (widoczny nick w nazwie); konto bez nicka (D37) pokazuje „Konto” i menu bez „Mój profil”. Zwinięty sidebar: sam avatar z nickiem w podpowiedzi, a nazwa aplikacji jako ikona książki z podpowiedzią.
- 95: pasek mobile jest w `app-sidebar.tsx` (stan szuflady), stały (`fixed`, 2.5rem); `app-shell.tsx` daje `<main>` odstęp `pt-10 md:pt-0`, a edytor ma wysokość `100dvh-2.5rem` poniżej `md` i mniejszy poziomy odstęp (`px-3`, wcześniej `px-9` omijało pływający hamburger).
- 95: gość: nazwa aplikacji tylko w górnym pasku strony głównej (obok „Zaloguj się”); profile i fora gościa bez zmian. Przyciemnienie dialogów `bg-black/40` (wcześniej `bg-black/10` z rozmyciem); test `components/ui/no-backdrop-blur.test.ts` pilnuje braku `backdrop-blur` w `components/` i `app/`. Polski tytuł strony i nagłówek feedu też „Aktualności”.
- 95: przekierowanie na `/en/auth/login` (404) z UI checku 94 to artefakt: `/pl/auth/login` nie jest stroną, więc gość trafił na logowanie z tym `callbackUrl`, a po zalogowaniu zapisany język konta zmienił prefiks. Żaden link w aplikacji nie prowadzi pod `/auth/login`; bez zmian w kodzie.
- 96: `components/page-container.tsx` (`width="narrow" | "wide"`) daje wszystkim stronom ten sam odstęp (`px-4 py-8 sm:px-6`, wcześniej część stron `px-6 py-10`, także u gościa na `/p/...`); odstęp między sekcjami zostaje stronom (`className`, np. `gap-8` w rozdziale, `gap-10` na stronie głównej). Biblioteka z `max-w-4xl` na wąski, admin z `max-w-3xl` na szeroki; publiczna książka wąska jak rozdział (czytanie). Edytor i strona 404 bez kontenera.
- 96: publiczna książka i rozdział dla zalogowanego w `AppShell` jak profil (sidebar pobiera tylko dane widza); gość dalej w samym `<main>`. Nazwy aplikacji dla gościa na profilu i forach nie dodano (bez zmian z 95).
- 97: na `/books` przyciski „Nowa książka” (główny) i „Nowy rozdział” (`outline`, dotychczasowe „Nowe opowiadanie” z domyślną książką) stoją przed ⋮, w menu zostały sortowanie i import; w książce „Nowy rozdział” (główny) przed ⋮, z menu usunięty. Nagłówki zawijają się (`flex-wrap`), błąd sortowania na liście w osobnym wierszu.
- 97: klucz `folders.sortNewest` zastąpiony `folders.sortOldest` („Od pierwszego” / „Oldest first”). Strona publiczna odwracała dotąd kolejność `created` (`readingOrder` w `lib/publish/queries.ts`); po zmianie `chapterOrder` funkcja usunięta, kolejność czytelnika się nie zmienia. Statystyki autora (`inReadingOrder`) już sortowały od najstarszego.
- 97: wiersz listy książek poniżej `sm`: liczba rozdziałów i data w osobnym wierszu pod nazwą i tagami (`whitespace-nowrap`), od `sm` jak dotąd w jednym wierszu. `npm run seed` bez zmian: rozdziały książek seeda mają rosnące `createdAt`, więc nowa kolejność to 1→N.
- 98: opis książki to zwykły tekst z `trim()`, zapisywany przyciskiem „Zapisz” pod polem (nie autozapisem jak notatki), akcją `saveFolderDescription`; zmienia `updatedAt` książki jak zmiana nazwy, `notesUpdatedAt` nie. Domyślne `""` w schemacie, bez migracji: brak pola czytany jako pusty opis (`getFolder`, wyszukiwarka). Wersje książki nie kopiują opisu (zapisują tylko rozdziały, nazwę i sortowanie).
- 98: eksport książki dopisuje niepusty opis do frontmattera `notes.md` (`description`); import ustawia go tylko nowej książce, istniejąca zachowuje swój opis (limit opisu sprawdzany tylko dla nowej książki). Opis czytany wyłącznie z `notes.md` w archiwum zip, nie z frontmattera pojedynczego pliku `.md`.
- 98: w wynikach wyszukiwarki opis w jednej uciętej linii pod autorem (pełny w `title`); lista „ostatnio opublikowane” na stronie głównej go nie pokazuje.
- 98: wiersz linku publicznego (`components/public-link.tsx`) renderuje się na serwerze (adres składany dopiero przy kopiowaniu), więc nie doładowuje się po hydratacji; „Otwórz” w nowej karcie. Etykieta statusu „Publiczny” / „Niepubliczny” bez podpowiedzi i bez fokusu (tekst jest widoczny). Szkielet paska narzędzi edytora WYSIWYG (puste miejsca tej samej wielkości) zamiast osobnego komponentu `skeleton`.
- 98: „Przywróć całą wersję” na stronie wersji jest nieaktywny, gdy żaden rozdział się nie różni (sama różnica sortowania nie włącza przycisku); „Przywróć” z menu ⋮ na liście wersji zostaje bez zmian (z potwierdzeniem).
- 99: górny odstęp to dokładnie dwie wysokości linii pola (`TOP_GAP_LINES` w `trackScrollGap`, wartość dalej w `--scroll-gap-top`); dolny bez zmian. Krótki tekst z odstępami mieści się teraz w wysokim polu i wtedy nie ma czego przewijać (dolny odstęp działa, gdy tekst jest dłuższy niż widok). Kotwice D27 bez zmian (liczone od bloków, nie od odstępu).
- 99: układ desktopowy dalej renderowany na serwerze (`useIsDesktop` zwraca `true` przed hydratacją), ale jego kontener ma `hidden md:flex`, więc wąski ekran przed hydratacją widzi nagłówek bez panelu bocznego; zakładki mobile i pole treści pojawiają się po hydratacji.
- 99: pasek notatek (rozdziału i książki, także na stronie książki) zajmuje swoje miejsce, ale jest `invisible`, dopóki fokus nie jest w grupie pola (`:focus-within`) albo nie jest otwarte wyszukiwanie; tekst się nie przesuwa. Bez fokusu przełącznik trybów notatek jest niedostępny myszą (Ctrl+F działa); helper E2E `markdownEditor().mode()` najpierw ustawia fokus w polu.
- 99: klucze `markdownEditor.preview` / `source` zostają, zmieniły się wartości („Tekst” / „Markdown”) i `proofread.sourceBlocked`. Na wąskim ekranie zakładka „Tekst” (93) i tryb „Tekst” mają tę samą nazwę (zakładka vs przycisk w grupie „Tryb”).
- 99: osobne ustawienie `appearance.editorSidebarCollapsed` (domyślnie `true`, bez migracji) obok `sidebarCollapsed`; `AppSidebar` trzyma oba stany i wybiera po adresie (`/chapters/…`), przycisk zapisuje ten, który dotyczy bieżącej strony.
- 99: status w stopce ma cztery stany: „Zapisywanie…”, błąd, „Zapisano” (pola zgodne z ostatnim zapisem, też zaraz po otwarciu) i „Niezapisane zmiany” (`save.unsaved`) w czasie oczekiwania na autozapis – żeby „Zapisano” nie pokazywało się przy niezapisanym tekście. Status notatek książki zostaje w ich nagłówku.
- 99: na 375 px pole tytułu ma `grow basis-40`, więc ⋮ stoi w jego wierszu (link do książki nad nimi, gdy się nie mieści). „Nowy rozdział” w panelu Rozdziały ma domyślną wysokość przycisku (32 px zamiast 28). Panel Narzędzia: odstęp kart `p-4` zamiast `p-3` (na zrzutach raportu karty miały 12 px od krawędzi okna).
- 99: na wąskim ekranie link powrotu do książki w nagłówku edytora pokazuje samą strzałkę (nazwa książki jako tekst dla czytników ekranu i w `title`), żeby tytuł i ⋮ mieściły się w jednym wierszu.
