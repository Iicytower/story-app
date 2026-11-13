# Raport UI/UX po poprawkach – Story App

Data: 2026-11-13. Audyt końcowy taska 51 (subtask 107, [D83](decisions/D083-poprawa-ux-ui.md)) – porównanie z raportem [`docs/ui-ux-report.md`](ui-ux-report.md) z 2026-11-12 (numery punktów w nawiasach są z tamtego raportu).

Metoda: skrypty Playwright na dev serverze (`npm run dev`, dane z `npm run seed`), konta `seed_anna` (autorka), `seed_ben` (czytelnik), `seed_admin`, gość i nowe konto bez danych. Wszystkie ekrany z pierwotnego raportu w 8 wariantach: 1280 / 375 px × jasny / ciemny × `en` / `pl` (33 ekrany na wariant), do tego obszary z sekcji 10 pierwotnego raportu. Na każdej stronie mierzone: przewijanie w poziomie, przyciski bez nazwy dostępnej, błędy konsoli i naruszenia CSP. Ocena według heurystyk Nielsena i Kruga, skala ważności 0–4.

Zrzuty: `docs/ui-ux-report-after/NN-*.png`, zrobione **przed** poprawkami z tego taska (sekcja 11) – część pokazuje problemy, które są już poprawione. Zostały tylko zrzuty, do których odwołuje się raport (39); pozostałe 268 z audytu przeniesione poza repo (`/tmp/autorun51/audit-shots`).

## Ocena: 8/10 (wcześniej 6/10)

Pasmo 8–9: brak problemów ważności 3, kilka drobnych (1–2), żaden nie utrudnia głównych zadań.

Wszystkie pięć problemów ważności 3 z pierwotnego raportu jest rozwiązanych: jedno nazewnictwo Książka / Rozdział (3.1), widoczne „Nowa książka” i „Nowy rozdział” (3.2), daty w strefie przeglądarki (8.1), edytor bez pustej połowy ekranu (4.1) i bez przeskoku układu na mobile (4.2). Nawigacja ma tożsamość (nazwa aplikacji, blok konta), dwie szerokości treści, sidebar na stronach publicznych dla zalogowanych. Na żadnej stronie w żadnym wariancie nie ma przewijania w poziomie (po poprawce długich tytułów), błędów konsoli ani naruszeń CSP; w `/pl` nie ma angielskich tekstów, odmiana liczebników jest poprawna.

Do 10/10 brakuje: stron błędu w układzie aplikacji (404 bez nawigacji), tytułów kart z nazwą książki, kilku drobiazgów tekstowych i miejsca nad notatkami (backlog, sekcja 12).

## Top 10 (stan po poprawkach)

| # | Problem | Ważność | Heurystyka | Stan |
|---|---------|---------|------------|------|
| 1 | Strona 404 bez nawigacji, także `/stats` konta bez publikacji | 2 | Wyjście awaryjne (N3) | backlog |
| 2 | Długi tytuł bez spacji przewijał `/books` i stronę książki w poziomie | 2 | Odporność układu | poprawione (107) |
| 3 | Brak linku „Przejdź do treści”: 13 przystanków Tab przed treścią | 2 | Dostępność | poprawione (107) |
| 4 | Fokus ginie (na `body`) po zamknięciu ustawień otwartych z menu konta | 2 | Dostępność | poprawione (107) |
| 5 | Notatki: krótka notatka wygląda na wyśrodkowaną (miejsce na ukryty pasek) | 1 | Minimalizm (N8) | backlog |
| 6 | Tytuły kart „Książka / Wersja / Edytor – Story App” bez nazwy | 1 | Rozpoznawanie (N6) | backlog |
| 7 | Nieudane logowanie czyściło też nick | 1 | Zapobieganie błędom (N5) | poprawione (107) |
| 8 | Menu konta na mobile nie zakrywało plakietki „Moderacja” | 1 | Estetyka | poprawione (107) |
| 9 | Placeholder wyszukiwarki `/books` ucięty na 375 px | 1 | Spójność | poprawione (107) |
| 10 | Domyślne półki biblioteki po polsku w `/en` | 1 | Spójność (N4) | backlog |

---

## 1. Nawigacja i elementy globalne

**1.1 Nazwa aplikacji i tożsamość** – poprawione (95). Na górze sidebara „Story App” (link do `/`), na dole blok konta (avatar + nick) z menu „Mój profil / Ustawienia / Wyloguj” (`05-home-1280-light-en`, `27-account-menu-1280-light-en`). Klawiatura: Enter otwiera menu, strzałki, Escape wraca na przycisk.

**1.2 Pozycje sidebara** – poprawione (95, 104, 106). „Aktualności” w `pl`, „Moderacja” na dole nad blokiem konta z licznikiem oczekujących zgłoszeń, licznik nieprzeczytanych przy „Wiadomości”. Na mobile menu konta (otwierane w górę) zasłaniało wiersz „Moderacja”, ale plakietka „1” wystawała z prawej (`27-account-menu-375-dark-en`) – w 107 menu ma co najmniej szerokość przycisku konta i zakrywa cały wiersz.

**1.3 Publiczne strony z sidebarem** – poprawione (96, 105). Zalogowany ma sidebar na książce, rozdziale i profilu (`24-public-book-1280-light-en`, `25-public-chapter-1280-light-en`); gość ma górny pasek z nazwą aplikacji i „Zaloguj się”.

**1.4 Szerokość treści** – poprawione (96). Dwa warianty: wąski 720 px (strona główna, aktualności, biblioteka, fora, wiadomości, profil, moderacja, strony publiczne) i szeroki 976 px (książki, książka, wersje, statystyki, admin).

**1.5 Rozmycie tła** – poprawione (95). Żaden dialog ani panel nie ma `backdrop-filter`.

## 2. Strona główna

**2.1 Skrót do pisania** – poprawione (100). „Ostatnio edytowane: <rozdział> (<książka>)” + „Kontynuuj” + „Nowa książka” (`05-home-1280-light-en`, `05-home-375-dark-pl`). Nowe konto widzi tylko „Nowa książka” (`50-empty-home-1280-light-pl`).

**2.2 Długość strony** – poprawione (100). 1942 px przy 1280 (było ok. 3600); bez „Popularne w kategoriach” i „Od obserwowanych”.

**2.3 Wyszukiwarka** – poprawione (100, 107). Na stronie głównej przycisk z lupą, krótki placeholder, etykiety „Kategorie” / „Tagi”. Placeholder na `/books` („…wszystkich książek, naciśnij Enter”) był ucięty na 375 px w obu językach (`06-books-375-dark-pl`) – w 107 skrócony do „Szukaj w tytułach i treści” / „Search titles and text”. Słowo „opowiadań” w „Szukaj opowiadań” zostaje (wyjątek w D83).

**2.4 Mobile** – poprawione (95, 100). Cienki pasek z hamburgerem (kropka przy nieprzeczytanych) i nazwą aplikacji; data w linii z autorem.

## 3. Książki, książka, wersje

**3.1 Nazewnictwo** – poprawione (93). „Książki / Nowa książka / Nowy rozdział / rozdziały” w sidebarze, nagłówkach, tytułach kart i menu, w obu językach; adresy `/books`, `/chapters`.

**3.2 Główne akcje** – poprawione (97). „Nowa książka” i „Nowy rozdział” jako przyciski główne (`06-books-1280-light-en`, `07-book-1280-light-en`). Menu ⋮ w nagłówku listy miało nazwę samo „Akcje” obok „Akcje: <książka>” w wierszach – w 107 „Akcje: wszystkie książki” / „Actions for all books”.

**3.3 Kolejność rozdziałów** – poprawione (97). 1 → N.

**3.4 Tagi w rozdziałach** – poprawione (97). Tylko tagi różne od tagów książki.

**3.5 Status publikacji** – poprawione (97). Etykiety „Publiczny” / „Niepubliczny” obok ikony.

**3.6 Link publiczny** – poprawione (97). Kompaktowy wiersz „Publiczny · Kopiuj link · Otwórz”.

**3.7 Notatki książki: tekst na środku** – częściowo. Górny odstęp to już dwie linie (99), ale nad nim stoi niewidoczny pasek narzędzi notatek (widoczny przy fokusie, 99), który w wąskim panelu zawija się do dwóch wierszy i rezerwuje ok. 67 px – razem krótka notatka zaczyna się ok. 115 px pod nagłówkiem i nadal wygląda na wyśrodkowaną (`07-book-1280-light-en`, `10-editor-tab-notes-1280-light-en`). Zwinięcie paska przesuwałoby tekst przy kliknięciu, więc to nie drobna poprawka – backlog.

**3.8 Wersje** – poprawione (98). „Przywróć całą wersję” nieaktywny, gdy nic się nie różni; styl drugorzędny i potwierdzenie; klikalny cały wiersz (`08-version-1280-light-en`).

**3.9 Przesunięcia przy ładowaniu** – poprawione (98). Szkielety o stałej wysokości; po 0,7–1,2 s brak przesunięć na zrzutach (pierwsze malowanie niezmierzone, pokrywa E2E z 98).

Nowe w 107: opis książki („Opis książki”) stał tuż pod tagami (4 px) i miał 672 px w kontenerze 976 px (`07-book-1280-light-en`) – teraz odstęp nad etykietą i pełna szerokość kolumny.

## 4. Edytor

**4.1 Pusta przestrzeń nad tekstem** – poprawione (99). Tekst ok. 70 px pod paskiem narzędzi na desktopie (`09-editor-1280-light-en`), na mobile pierwszy wiersz na 330/812 px (było 528) (`09-editor-375-dark-pl`).

**4.2 Układ przed hydratacją** – poprawione (99). Bez JavaScriptu na 375 px pod paskiem jest pusty obszar, bez układu desktopowego i bez przeskoku.

**4.3 Paski narzędzi** – poprawione (99). Pasek notatek tylko przy fokusie; widoczny jeden pasek (`10-editor-tab-notes-1280-light-en`).

**4.4 Nazwy trybów** – poprawione (99). „Tekst” / „Markdown”.

**4.5 Sidebar w edytorze** – poprawione (99). Zwinięty do paska ikon; ręczne rozwinięcie zapamiętane (pokrywa E2E z 99, na dev serverze niezweryfikowane – sekcja 13).

**4.6 Status zapisu** – poprawione (99). Stałe „Zapisano” obok licznika słów.

**4.7 Panel Narzędzia** – poprawione (99). Margines kart (`12-editor-tab-tools-1280-light-en`).

## 5. Biblioteka, aktualności, statystyki

**5.1 Biblioteka** – poprawione (102). Przełącznik „Biblioteka publiczna” w „Zarządzaj półkami” (`14-library-1280-light-en`). Nowe: domyślne półki mają nazwy zapisane w języku konta, więc konto polskie widzi „Czytam / Na później / Przeczytane” w `/en` – backlog.

**5.2 Aktualności** – poprawione (104). Jeden wyróżniony link na wpis (`15-feed-1280-light-en`).

**5.3 Statystyki** – poprawione (102). Wykres bez animacji, szkielet o stałej wysokości, opis w jednym zdaniu (`16-stats-1280-light-en`).

## 6. Społeczność

**6.1 Lista forów** – poprawione (103). „1 wątek · ostatni post …”, „Brak wątków” (`17-forums-1280-light-en`).

**6.2 Formularz nowego wątku** – poprawione (103). Przycisk „Nowy wątek”.

**6.3 Reakcje** – poprawione (103). Tylko użyte reakcje + „Dodaj reakcję”, bez łącznego licznika.

**6.4 Wiadomości** – poprawione (104). Podgląd ostatniej wiadomości, „Ty: …” dla własnych, kropka przy nieprzeczytanych (`20-messages-1280-light-en`). Pusty stan w `pl` miał „Zacznij ją…” bez rzeczownika (`56-empty-messages-1280-light-pl`) – w 107 „Zacznij rozmowę przyciskiem „Nowa wiadomość” albo „Wiadomość” na czyimś profilu.”, w `en` nazwy przycisków w cudzysłowach.

**6.5 Powiadomienia** – poprawione (94). Czas względny, grupa „Dzisiaj” (`22-notifications-1280-light-en`).

**6.6 Edycja profilu** – poprawione (101, 102). „Edytuj profil” na własnym profilu, „O mnie” wszędzie (`23-public-profile-1280-light-en`). Przycisk zapisu „Zaktualizuj „O mnie”” różnił się od „Zapisz avatar” w tej samej zakładce – w 107 „Zapisz „O mnie”” / „Save “About me””.

**6.7 Strona książki** – poprawione (105). „Zacznij czytać” / „Czytaj dalej: <rozdział>” jako przycisk główny, średnia jako tekst „4,5 · 6 ocen”, gwiazdki tylko jako „Twoja ocena”, okładka i opis (`24-public-book-1280-light-en`, `24-public-book-375-dark-pl`). Spis treści pokazuje podwójną numerację („1. Rozdział 1. …”), bo tytuły seed zawierają numer – zostaje.

**6.8 Rozdział publiczny** – poprawione (105). „Następny rozdział →” bezpośrednio pod tekstem, potem reakcje; pasek zakładek z ramką (`25-public-chapter-1280-light-en`, `25-public-chapter-375-dark-pl`). Obie oceny zostają (decyzja D83).

## 7. Ustawienia, moderacja, admin

**7.1 Ustawienia** – poprawione (101). Dialog z zakładkami Wygląd / Profil / Konto / Powiadomienia (`28-settings-appearance-1280-light-en`, `28-settings-wygląd-375-dark-pl`). Na 375 px w `en` zakładka „Notifications” spada do drugiego wiersza, w `pl` mieszczą się w jednym – akceptowalne.

**7.2 Liczniki moderacji** – poprawione (106). Plakietka przy „Moderacja” i „Zgłoszenia 1” (`26-moderation-1280-light-en`).

**7.3 Ban w panelu admina** – poprawione (106). Przycisk z czerwonym obrysem, etykieta „Zgłoszony profil: seed_troll” (`32-admin-1280-light-en`).

## 8. Błędy

**8.1 Strefa czasowa** – poprawione (94). Przy strefie przeglądarki UTC i Europe/Warsaw te same dane przesuwają się o dokładnie 1 h na stronie wersji, liście wersji, w moderacji, adminie i wiadomościach; między stronami nie ma rozbieżności.

## 9. Co działa dobrze

- Wszystkie problemy ważności 3 z pierwotnego raportu rozwiązane.
- Brak przewijania w poziomie w każdym z 8 wariantów (po poprawce długich tytułów), brak przycisków ikon bez nazwy dostępnej, brak błędów konsoli i naruszeń CSP.
- Tłumaczenia kompletne w `pl` i `en`, w tym dialogi, menu, puste stany i komunikaty błędów; odmiana liczebników poprawna („1 rozdział / 4 rozdziały / 0 rozdziałów”, „3 oceny / 6 ocen”, „22 minuty temu”).
- Tryb ciemny bez problemów z czytelnością.
- Spójny, spokojny wygląd, mało animacji – zgodnie z priorytetem prostoty.

## 10. Obszary niesprawdzone w pierwotnym raporcie

**Puste stany nowego konta** (1280 jasny i 375 ciemny `pl`, bez przewijania w poziomie): strona główna – tylko „Nowa książka” (`50-empty-home-1280-light-pl`); książki – „Nie ma jeszcze książek. Utwórz książkę albo nowy rozdział.” (`51-empty-books-1280-light-pl`); biblioteka, aktualności (z linkiem do strony głównej), profil, moderacja, fora, książka bez rozdziałów i wersji – czytelne teksty. Sidebar nowego konta ukrywa Moderację i Statystyki. Wyjątek: `/stats` wpisane ręcznie (zakładka, stary link) daje gołą stronę „404 | Nie znaleziono tej strony.” bez nawigacji (`54-empty-stats-1280-light-pl`), tak samo każdy nieznany adres (`60-404-1280-light-pl`) – backlog.

**Komunikaty błędów:** złe hasło i nieznany nick dają ten sam komunikat „Nieprawidłowy nick lub hasło.” w dialogu (bez ujawniania kont) (`40-error-wrong-login-1280-light-pl`); formularz czyścił oba pola – w 107 nick zostaje, czyści się tylko hasło. Rejestracja: komunikat o nicku w linii i lista warunków hasła na żywo (`41-error-signup-validation-1280-light-pl`). Zmiana hasła z różnymi powtórzeniami: komunikat w linii. Za długie dane: tytuł książki ma `maxlength=200` (ucina bez komunikatu), „O mnie” ma licznik „600 / 1000”. Nieudany zapis po stronie serwera nie jest osiągalny z UI (pokrywają go testy integracyjne akcji); pusty tytuł książki niezweryfikowany.

**Klawiatura i widoczność focusu:** pierścień focusu widoczny na linkach sidebara, przyciskach i zakładkach dialogów (`70-focus-sidebar-1280-light-pl`), pierwszy link (nazwa aplikacji) i pola w ustawieniach mają domyślny obrys przeglądarki – widoczny. Dialog ustawień trzyma fokus w środku (`72-focus-settings-dialog-1280-light-pl`). Przed treścią było 13 przystanków Tab – w 107 pierwszy przystanek to „Przejdź do treści” (widoczny przy fokusie). Po zamknięciu ustawień otwartych z menu konta fokus trafiał na `body` – w 107 wraca na przycisk konta (na mobile na przycisk menu).

**Wyniki wyszukiwania:** `/books?q=…` – rozdziały z „w książce „…””, fragmentem i podświetleniem trafienia (`76-search-books-1280-light-pl`); brak wyników: „Żaden rozdział nie pasuje do „…”.”; strona główna – wyniki pod formularzem.

**Menu ⋮ wiersza książki:** przyciski „Akcje: <książka>”, pozycje Tagi / Zmień nazwę / Wycofaj publikację / Oznacz jako 18+ / Usuń (czerwone, oddzielone), Enter / strzałki / Escape działają, fokus wraca (`75-book-row-menu-1280-light-pl`).

**Mobile na wszystkich stronach:** wszystkie 33 ekrany i puste stany na 375 px bez przewijania w poziomie, poza długim tytułem bez spacji (`63-longtitle-books-375-dark-pl`, poprawione w 107). Zakładki moderacji zawijają się do dwóch wierszy – akceptowalne.

## 11. Poprawki w tym tasku (107)

| Poprawka | Test |
|----------|------|
| Długie tytuły bez spacji: łamanie w wierszu książki, wyniku wyszukiwania, nazwie książki w wyniku, `h1` i wierszu rozdziału; siatka strony książki z `minmax(0,1fr)` | E2E `layout.spec.ts` „a long title without spaces does not scroll the page sideways” (1280 i 375, `/books`, książka, wyszukiwanie) |
| Link „Przejdź do treści” w `AppShell`, `main` z `id="main"` | E2E `layout.spec.ts` „the first Tab stop skips the navigation to the page content” |
| Fokus wraca na przycisk konta (mobile: przycisk menu) po zamknięciu ustawień otwartych z menu konta | E2E `layout.spec.ts` (desktop i 375) |
| Menu konta szerokie co najmniej jak jego przycisk (zakrywa plakietkę „Moderacja” w szufladzie) | E2E `layout.spec.ts` „the account menu covers the Moderation row in the drawer” |
| Nieudane logowanie zostawia nick | E2E `auth.spec.ts` „wrong password shows an error” |
| Krótszy placeholder `/books`, „Akcje: wszystkie książki”, pusty stan wiadomości, „Zapisz „O mnie””, odstęp i szerokość opisu książki | `manual` (teksty i CSS; nazwy przycisków pilnują istniejące E2E `sorting`, `register`, `profile`) |

Stabilizacja: `reading-progress.spec.ts` „saves the reading position…” przesuwał zegar przed hydratacją, więc licznik zapisu mógł jeszcze nie istnieć – teraz zegar przesuwa się w pętli `expect.poll`. `find-replace.spec.ts:86` bez oczywistej przyczyny czasowej – bez zmian. Raz czerwony w przebiegu 107: `folders.spec.ts:242` („saves the book description…”, `fill` po `reload` dopisał tekst przed starą wartością – wyścig z hydratacją), potem 3/3 zielone; bez zmian.

## 12. Backlog (w `docs/tasks/README.md`)

- Strona 404 w układzie aplikacji dla zalogowanych; `/stats` konta bez publikacji jako pusty stan.
- Tytuły kart z nazwą książki, wersji i rozdziału.
- Notatki: miejsce na ukryty pasek narzędzi nad tekstem (3.7).
- Domyślne półki biblioteki w języku konta, nie UI.
- Z audytu bezpieczeństwa (koszt zapytań, nie krytyczne): liczniki kategorii `/forums` przy każdym wejściu, licznik zgłoszeń w `AppShell` na każdej stronie, `getLastEditedChapter` z `$in` po wszystkich książkach, migracja usuwająca stare dokumenty `tag:*` z `rankings` (indeks `Story {userId, publishedAt}` usuwa już `syncIndexes()` w buildzie).

Zostają bez zmian (decyzja): zapis rodzaju „(a)” / „(-ęła)” w moderacji – druga forma tylko tam, gdzie „(a)” nie pasuje gramatycznie („usunął” → „usunęła”); „Niepubliczny” jako nazwa statusu; przekierowanie na język konta po zalogowaniu (D46); podwójna numeracja w spisie treści przy tytułach z numerem.

## 13. `manual` i niezweryfikowane

- `manual`: kryteria 1 i 2 taska 107 (przegląd tego raportu przez użytkownika); poprawki tekstowe i CSS z tabeli w sekcji 11.
- Niezweryfikowane na dev serverze (działał na starszym kodzie): zapis opisu książki (pole widoczne i wypełnione) i zapamiętanie stanu sidebara w edytorze – pokrywają je E2E z tasków 98 i 99.
- Niesprawdzone: pozostałe zakładki panelu admina (zrzut tylko „Zgłoszenia”), pełna ścieżka Tab po pasku edytora, menu ⋮ rozdziałów i postów forum (nazwy dostępne istnieją), licznik nieprzeczytanych wiadomości na danych seed (pokrywa E2E z 104), pierwsze malowanie strony książki (3.9).
