# Spis decyzji

Decyzje i odstępstwa od `docs/spec.md` – mają pierwszeństwo nad spec, a przy sprzeczności obowiązuje nowsza. Jeden plik na decyzję; znajdź wiersz i otwórz tylko plik z linku. Zasady dopisywania i archiwizacji: D82.

## Aktualne

### Konta i bezpieczeństwo

- [**D1**](D001-konta-users.md) Konta w kolekcji `users`, wielu użytkowników – każde opowiadanie ma `userId`, cudze traktowane jak nieistniejące (404). Zmieniona w D37, D40, D42, D80.
- [**D4**](D004-authjs-env.md) Auth.js v5 i zmienne środowiskowe – `next-auth@5`, ochrona tras w `proxy.ts`, JWT. Zmieniona w D37, D40.
- [**D37**](D037-logowanie-nick.md) Logowanie przez nick, bez migracji danych – konto to nick i hasło, bez fallbacku na e-mail. Zmieniona w D80 (usuwanie konta, tombstone).
- [**D39**](D039-zmiana-hasla.md) Zmiana hasła, bez zmiany nicku – nick stały, więc adresy `/p/<nick>/...` są stałe.
- [**D40**](D040-rejestracja-limit-prob.md) Rejestracja i limit prób – publiczny `/register`, limit prób logowania i rejestracji.
- [**D71**](D071-typy-argumentow-akcji.md) Typy argumentów Server Actions – własne guardy `isString`/`isId`/… w `lib/action-input.ts`, błąd to `INVALID_INPUT`.
- [**D72**](D072-limity-danych.md) Limity rozmiaru i liczby danych – wartości w `lib/limits.ts` (tytuł, treść 500 000 znaków, notatki, wersje).
- [**D73**](D073-react-flight-duza-tresc.md) Zapis dużej treści a dekoder React Flight – obejście limitu sumy długości napisów w argumentach akcji.
- [**D74**](D074-zaufany-adres-klienta.md) Zaufany adres klienta w limitach – na Vercelu tylko `x-vercel-forwarded-for`, zmienna `TRUSTED_IP_HEADER`.
- [**D75**](D075-sesje-slabe-hasla.md) Unieważnianie sesji i słabe hasła – kolekcja `sessions` z `sid` w JWT, reguły siły hasła.
- [**D76**](D076-kody-odzyskiwania.md) Kody odzyskiwania konta – 10 kodów (HMAC w bazie), reset hasła przez nick i kod.
- [**D77**](D077-naglowki-csp.md) Nagłówki bezpieczeństwa i CSP – CSP z nonce w `proxy.ts`, HSTS.

### Edytor

- [**D8**](D008-podglad-skiphtml.md) Podgląd markdown z `skipHtml` – podgląd ukrywa surowy HTML i komentarze zamiast pokazywać je jako tekst.
- [**D9**](D009-savestory-autozapis.md) Szczegóły `saveStory` i autozapisu – `EMPTY_CONTENT`, ochrona przed nadpisaniem pustką, `CONFLICT`.
- [**D12**](D012-edytor-mobilny.md) Widok mobilny edytora – edytor działa na wąskim ekranie z przełącznikiem widoków. Zmieniona w D19, D41.
- [**D19**](D019-panele-edytora.md) Panele edytora – desktop: edytor i panel boczny z zakładkami Notes/Chapters. Zmieniona w D23, D41, D51.
- [**D20**](D020-edytor-wysiwyg.md) Edytor WYSIWYG – Tiptap v3, skróty, komentarze, Enter = akapit. Zmieniona w D28 (listy) i D35 (skróty Find).
- [**D21**](D021-pisownia.md) Sprawdzanie pisowni – wbudowany spellcheck przeglądarki. Zmieniona w D58 (korekta LanguageTool), D66.
- [**D22**](D022-rzadszy-autozapis.md) Rzadszy autozapis – autozapis 20 s po ostatnim klawiszu (spec: 3 s).
- [**D27**](D027-pozycja-przewijania.md) Pozycja przewijania przy przełączaniu widoków – dopasowanie po bloku między Preview i Source. Zmieniona w D41.
- [**D28**](D028-myslniki-dialogowe.md) Myślniki dialogowe – dialog z półpauzą `– Tekst` to zwykły akapit; `- ` nie tworzy już listy.
- [**D30**](D030-przewijanie-poza-tekst.md) Przewijanie poza tekst – odstęp nad pierwszą i pod ostatnią linią w każdym `MarkdownEditor`.
- [**D35**](D035-szukaj-zamien.md) Wyszukiwanie i zamiana w polu – Ctrl/Cmd+F i Ctrl/Cmd+H tylko z fokusem w edytorze, dekoracje ProseMirror.
- [**D51**](D051-bez-trybu-kolumn.md) Bez trybu kolumn w edytorze – tryb Split usunięty, zostaje panel boczny z zakładkami. Zastępuje część D41.
- [**D66**](D066-korekta-w-edytorze.md) Korekta w głównym edytorze – poprawki trafiają do edytora rozdziału, bez dialogu i panelu. Zastępuje D59.

### Foldery i opowiadania

- [**D7**](D007-tytul-trim.md) Tytuł przycinany (trim) – tytuł zapisywany po `trim()`, unikalność liczona po przycięciu.
- [**D16**](D016-foldery.md) Foldery – kolekcja `folders`, unikalna nazwa per użytkownik wśród aktywnych, rozdziały w folderze.
- [**D17**](D017-sortowanie.md) Tryby sortowania – foldery: updated/manual/alpha; rozdziały: created/manual itd. Zmieniona w D24 (miejsce zapisu), D55.
- [**D23**](D023-ustawienia-uzytkownika.md) Ustawienia użytkownika – układ edytora i motyw w ustawieniach zamiast `localStorage`. Zmieniona w D24.
- [**D24**](D024-kolekcja-settings.md) Kolekcja `settings` – jeden dokument ustawień na użytkownika (editor, appearance, folders). Zmienia D17 i D23.
- [**D25**](D025-wersje-folderow.md) Wersje folderów – ręcznie zapisywane stany rozdziałów, przywracanie całości lub wybranych, `chapterContents`.
- [**D36**](D036-tagi.md) Tagi – pole `tags` na folderach i rozdziałach, migracja `005-tags`. Częściowo zmieniona w D79 (wyszukiwanie).
- [**D55**](D055-menu-akcji-przeciaganie.md) Menu akcji (⋮) i przeciąganie zamiast strzałek – akcje w menu, kolejność ręczna przez dnd-kit. Zmienia D17, D53.
- [**D79**](D079-predefiniowane-tagi.md) Predefiniowane tagi – kolekcja `predefinedTags` (en/pl) jako podpowiedzi obok tagów własnych. Zmienia D36.

### Publikacja i strona publiczna

- [**D38**](D038-publikacja.md) Publikacja zamiast udostępniania linkiem – `folders.published` i `stories.publication`, adresy `/p/<nick>/<folder>/<rozdział>`. Zmieniona w D54.
- [**D42**](D042-publiczna-wyszukiwarka.md) Publiczna wyszukiwarka, strona główna i sidebar – `/` to wyszukiwarka i sidebar dla zalogowanych. Zmieniona w D54, D50, D80.
- [**D47**](D047-publiczny-link-bez-locale.md) Publiczny link bez prefiksu języka – link `/p/nick/folder` bez locale, język z przekierowania proxy.
- [**D54**](D054-strona-glowna.md) Strona główna z hero i ostatnio opublikowanymi – hero dla gościa, `stories.publishedAt`, wąski ekran. Zmienia D38, D42, D46.

### Eksport i import

- [**D10**](D010-eksport-md.md) Format eksportu `.md` – frontmatter YAML generowany bez biblioteki, daty ISO.
- [**D18**](D018-eksport-udostepnianie-folderu.md) Eksport i udostępnianie folderu – zip z rozdziałami przez `fflate`. Część o udostępnianiu zastąpiona przez D38.
- [**D31**](D031-eksport-formaty.md) Eksport do nowych formatów w przeglądarce – docx, odt, pdf, epub, fb2, html, txt, md.
- [**D32**](D032-zip-rozdzialy.md) Zip z osobnym plikiem na rozdział – przełącznik „One file per chapter (.zip)” w dialogu eksportu.
- [**D33**](D033-przycisk-export-as.md) Tylko przycisk „Export as…” – przyciski Export .md i .zip usunięte z UI.
- [**D34**](D034-import.md) Import opowiadań – formaty jak w eksporcie plus zip, plik do 50 MB, parsowanie w przeglądarce.

### UI i i18n

- [**D6**](D006-motyw-bez-pakietow.md) Motyw bez dodatkowych pakietów – inline skrypt w `<head>`, klasa `dark`, bez `next-themes`.
- [**D46**](D046-wielojezycznosc.md) Wielojęzyczny interfejs z prefiksem w adresie – next-intl, en i pl, aplikacja publiczna. Zmieniona w D54.
- [**D48**](D048-slownik-komunikatow.md) Słownik i komunikaty generowane – pliki `messages/*.json`, brakujący klucz to błąd `tsc`.
- [**D49**](D049-przelacznik-jezyka.md) Przełącznik języka i język po zalogowaniu – menu języków w sidebarze, nazwy we własnych językach.
- [**D50**](D050-dialog-ustawien.md) Dialog ustawień – motyw, język, hasło i wylogowanie w jednym dialogu „Settings”. Zmieniona w D80 (nowe ustawienia).
- [**D52**](D052-kontrast-motyw.md) Łagodniejszy kontrast i jeden motyw kolorystyczny – mniejszy kontrast przy zachowaniu WCAG AA.
- [**D53**](D053-tooltipy.md) Tooltipy przy przyciskach z samą ikoną – shadcn Tooltip zamiast `title`. Częściowo zmieniona w D55.

### Serwer narzędzi, korekta i słowniki

- [**D43**](D043-generator-nazw.md) Generator nazw – działa w przeglądarce, sylaby z tabel głosek, bez AI.
- [**D41**](D041-zakladka-tools.md) Zakładka Tools – trzeci panel boczny w edytorze. Zmieniona w D51 (bez Split).
- [**D56**](D056-serwer-narzedzi-docker.md) Serwer narzędzi lokalnie w Dockerze, flaga po zmiennych – Coolify i serwer docelowy w Dockerze (task 54).
- [**D57**](D057-serwer-narzedzi-polecenia.md) Lokalny serwer narzędzi: polecenia, konto, proxy – `npm run up`/`down`, konto, proxy.
- [**D58**](D058-languagetool.md) LanguageTool na serwerze narzędzi i język folderu – tekst do korekty tylko na własny serwer, na żądanie. Zmienia D21, D44.
- [**D60**](D060-slownik-uzytkownika.md) Słownik użytkownika w korekcie – słownik per konto w `settings.proofreading.dictionary`.
- [**D61**](D061-serwis-slownikowy.md) Serwis słownikowy i tabela form – PoliMorf jako tabela form, serwis słownikowy (task 25).
- [**D62**](D062-definicje-wikislownik.md) Definicje z Wikisłownika – kafelek Definitions, polska edycja z kaikki.org (task 32).
- [**D63**](D063-synonimy.md) Synonimy z Wikisłownika i Dobrego słownika – kafelek Synonyms, źródła wybrane po pomiarach (task 33).
- [**D64**](D064-rymy.md) Rymy z kluczy fonetycznych tabeli form – kafelek Rhymes, `lib/tools/rhyme-key.ts` (task 34).
- [**D65**](D065-filtry-rymow.md) Filtry rymów – filtr części mowy i zakres sylab, filtrowanie w SQL, limit 150 (task 35).

### Okładki i 18+

- [**D67**](D067-oznaczenie-18.md) Oznaczenie 18+ – pole `adult { manual, auto }` na folderze i rozdziale, filtr automatyczny (task 65). Częściowo zmieniona w D80 (18+ admina).
- [**D68**](D068-okladki-limity.md) Okładki folderów: decyzje przy starcie taska 26 – limity okładek, `COVERS_MAX_TOTAL_MB`, kopia przed migracją (zmienia D14).
- [**D69**](D069-wyswietlanie-okladek.md) Wyświetlanie okładek – rozmiary miniatur na listach i stronach, rozmycie okładek 18+ (task 40).

### Proces, branche, testy, wdrożenie

- [**D2**](D002-strategia-testow.md) Strategia testów – unit, integracyjne na MongoDB w Dockerze, E2E Playwright; każde kryterium ma test lub `manual`.
- [**D3**](D003-mongodb-docker.md) MongoDB w Dockerze dla testów i lokalnego dev – kontener `mongo:8`, osobne bazy testowe, start w `globalSetup`.
- [**D5**](D005-uruchamianie-e2e.md) Uruchamianie E2E – Playwright z `next build` + `next start` na porcie 3100, osobny `distDir`.
- [**D14**](D014-migracje.md) System migracji – własny mechanizm `migrations/NNN-*.ts`, kopia przed migracją. Zmieniona w D68.
- [**D15**](D015-branch-develop.md) Branch `develop` – przepływ feature → `develop` → `staging` → `main`. Częściowo zmieniona w D45.
- [**D26**](D026-backup-bazy.md) Lokalny backup bazy – `scripts/backup.sh` (bash + Docker) zamiast skryptu `tsx`.
- [**D45**](D045-bez-merge-staging-main.md) Claude nie merguje do `staging` i `main` – merge i push na te branche robi tylko użytkownik. Zmienia D15.
- [**D81**](D081-narzedzia-ux-ui.md) Narzędzia Claude do UX i UI – skille `frontend-design`, `ux-heuristics`, `web-design-guidelines`, MCP `shadcn` i `playwright`, bez Claude in Chrome.
- [**D82**](D082-decyzje-w-plikach.md) Decyzje w osobnych plikach – plik na decyzję, spis z jednym zdaniem, statusy aktualna/archiwalna, zasady dopisywania i archiwizacji.

### System społecznościowy

- [**D80**](D080-system-spolecznosciowy/index.md) System społecznościowy (taski 68–91, branch `feature/social`) – profile, relacje, komentarze, DM, fora, role i bany; zmienia D1, D37, D42, D50, D67, D79. Czytaj zawsze `scope.md` i `roles-bans-blocks.md` oraz plik obszaru taska.
  - [`scope.md`](D080-system-spolecznosciowy/scope.md) – zakres i zasady ogólne, rozstrzygnięcia bez taska i z taska 91.
  - [`roles-bans-blocks.md`](D080-system-spolecznosciowy/roles-bans-blocks.md) – role, bany, blokady (taski 69, 79, 80, 86).
  - [`profile-relations-library.md`](D080-system-spolecznosciowy/profile-relations-library.md) – profil, relacje, biblioteka (taski 70, 71, 72, 73, 74).
  - [`text-interactions.md`](D080-system-spolecznosciowy/text-interactions.md) – interakcje z tekstem (taski 76, 77, 78, 82).
  - [`notifications-dm-realtime.md`](D080-system-spolecznosciowy/notifications-dm-realtime.md) – powiadomienia, DM, realtime (taski 81, 85, 90).
  - [`stats-discovery.md`](D080-system-spolecznosciowy/stats-discovery.md) – statystyki i odkrywanie (taski 75, 83, 84).
  - [`forums-admin.md`](D080-system-spolecznosciowy/forums-admin.md) – fora i panel admina (taski 87, 88).
  - [`account.md`](D080-system-spolecznosciowy/account.md) – konto, w tym usuwanie konta (task 89).
  - [`navigation.md`](D080-system-spolecznosciowy/navigation.md) – nawigacja (bez przypisanego taska).
  - [`process.md`](D080-system-spolecznosciowy/process.md) – przebieg i branche (autorun, merge do `feature/social`).

## Archiwalne

Nie obowiązują albo opisują zamknięty etap; czytaj tylko przy pytaniu o historię lub gdy status wskazuje część nadal aktualną.

- [**D11**](D011-udostepnianie.md) Szczegóły udostępniania – zastąpiona przez D38 (publikacja zamiast linków).
- [**D13**](D013-branche-po-1-0.md) Branche i środowiska po wersji 1.0 – przepływ branchy zastąpiony przez D15 i D45; tag `v1.0.0` i baza stagingu opisuje `docs/deploy.md`.
- [**D29**](D029-menu-konta.md) Menu konta zamiast górnego paska – górny pasek i menu konta zastąpione sidebarem z D42.
- [**D44**](D044-jezyk-folderu-languagetool.md) Język folderu w tasku LanguageTool – zakres taska 31 wchłonięty przez task 29, zastąpiona przez D58.
- [**D59**](D059-korekta-w-dialogu.md) Korekta w dialogu w stylu propozycji zmian – dialog, panel i „Accept” zastąpiła korekta w głównym edytorze (D66); sprawdzanie, mapowanie pozycji, zakreślenia i reguły obowiązują dalej.
- [**D70**](D070-branch-security.md) Branch `security` i aktualizacja zależności – branch `security` zmergowany do `develop`; TypeScript zostaje na 6.x, dopóki `typescript-eslint` nie obsługuje TS 7.
- [**D78**](D078-rozstrzygniecia-do-potwierdzenia.md) Decyzje Claude'a z nocy 2026-11-09/10 do potwierdzenia – lista niepotwierdzonych rozstrzygnięć Claude'a do D70–D77.
