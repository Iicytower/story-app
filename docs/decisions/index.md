# Spis decyzji

Spis pomaga wybrać decyzję do otwarcia; nie zastępuje jej treści. Znajdź wiersz, potem `grep -n "^## D38" docs/decisions.md` i Read z offset/limit (D80 jest w plikach `docs/decisions/d80/`). `docs/decisions.md` ma pierwszeństwo nad `docs/spec.md`; przy sprzecznych decyzjach obowiązuje nowsza, o ile status nie mówi inaczej. Nowa decyzja w `decisions.md` = nowy wiersz w odpowiedniej sekcji tego spisu.

## Konta i bezpieczeństwo

- **D1** Konta w kolekcji `users`, wielu użytkowników – każde opowiadanie ma `userId`, cudze traktowane jak nieistniejące (404). Zmieniona w D37, D40, D42, D80.
- **D4** Auth.js v5 i zmienne środowiskowe – `next-auth@5`, ochrona tras w `proxy.ts`, JWT. Zmieniona w D37, D40.
- **D37** Logowanie przez nick, bez migracji danych – konto to nick i hasło, bez fallbacku na e-mail. Zmieniona w D80 (usuwanie konta, tombstone).
- **D39** Zmiana hasła, bez zmiany nicku – nick stały, więc adresy `/p/<nick>/...` są stałe.
- **D40** Rejestracja i limit prób – publiczny `/register`, limit prób logowania i rejestracji.
- **D70** Branch `security` i aktualizacja zależności – taski 56–63 na lokalnym branchu zbiorczym, TypeScript 6.0.3.
- **D71** Typy argumentów Server Actions – własne guardy `isString`/`isId`/… w `lib/action-input.ts`, błąd to `INVALID_INPUT`.
- **D72** Limity rozmiaru i liczby danych – wartości w `lib/limits.ts` (tytuł, treść 500 000 znaków, notatki, wersje).
- **D73** Zapis dużej treści a dekoder React Flight – obejście limitu sumy długości napisów w argumentach akcji.
- **D74** Zaufany adres klienta w limitach – na Vercelu tylko `x-vercel-forwarded-for`, zmienna `TRUSTED_IP_HEADER`.
- **D75** Unieważnianie sesji i słabe hasła – kolekcja `sessions` z `sid` w JWT, reguły siły hasła.
- **D76** Kody odzyskiwania konta – 10 kodów (HMAC w bazie), reset hasła przez nick i kod.
- **D77** Nagłówki bezpieczeństwa i CSP – CSP z nonce w `proxy.ts`, HSTS.
- **D78** Decyzje Claude'a z nocy 2026-11-09/10 do potwierdzenia – rozstrzygnięcia do D70–D77 niepotwierdzone przez użytkownika. Uzupełnia D70–D77.

## Edytor

- **D8** Podgląd markdown z `skipHtml` – podgląd ukrywa surowy HTML i komentarze zamiast pokazywać je jako tekst.
- **D9** Szczegóły `saveStory` i autozapisu – `EMPTY_CONTENT`, ochrona przed nadpisaniem pustką, `CONFLICT`.
- **D12** Widok mobilny edytora – edytor działa na wąskim ekranie z przełącznikiem widoków. Zmieniona w D19, D41.
- **D19** Panele edytora – desktop: edytor i panel boczny z zakładkami Notes/Chapters. Zmieniona w D23, D41, D51.
- **D20** Edytor WYSIWYG – Tiptap v3, skróty, komentarze, Enter = akapit. Zmieniona w D28 (listy) i D35 (skróty Find).
- **D21** Sprawdzanie pisowni – wbudowany spellcheck przeglądarki. Zmieniona w D58 (korekta LanguageTool), D66.
- **D22** Rzadszy autozapis – autozapis 20 s po ostatnim klawiszu (spec: 3 s).
- **D27** Pozycja przewijania przy przełączaniu widoków – dopasowanie po bloku między Preview i Source. Zmieniona w D41.
- **D28** Myślniki dialogowe – dialog z półpauzą `– Tekst` to zwykły akapit; `- ` nie tworzy już listy.
- **D30** Przewijanie poza tekst – odstęp nad pierwszą i pod ostatnią linią w każdym `MarkdownEditor`.
- **D35** Wyszukiwanie i zamiana w polu – Ctrl/Cmd+F i Ctrl/Cmd+H tylko z fokusem w edytorze, dekoracje ProseMirror.
- **D51** Bez trybu kolumn w edytorze – tryb Split usunięty, zostaje panel boczny z zakładkami. Zastępuje część D41.
- **D66** Korekta w głównym edytorze – poprawki trafiają do edytora rozdziału, bez dialogu i panelu. Zastępuje D59.

## Foldery i opowiadania

- **D7** Tytuł przycinany (trim) – tytuł zapisywany po `trim()`, unikalność liczona po przycięciu.
- **D16** Foldery – kolekcja `folders`, unikalna nazwa per użytkownik wśród aktywnych, rozdziały w folderze.
- **D17** Tryby sortowania – foldery: updated/manual/alpha; rozdziały: created/manual itd. Zmieniona w D24 (miejsce zapisu), D55.
- **D23** Ustawienia użytkownika – układ edytora i motyw w ustawieniach zamiast `localStorage`. Zmieniona w D24.
- **D24** Kolekcja `settings` – jeden dokument ustawień na użytkownika (editor, appearance, folders). Zmienia D17 i D23.
- **D25** Wersje folderów – ręcznie zapisywane stany rozdziałów, przywracanie całości lub wybranych, `chapterContents`.
- **D36** Tagi – pole `tags` na folderach i rozdziałach, migracja `005-tags`. Częściowo zmieniona w D79 (wyszukiwanie).
- **D55** Menu akcji (⋮) i przeciąganie zamiast strzałek – akcje w menu, kolejność ręczna przez dnd-kit. Zmienia D17, D53.
- **D79** Predefiniowane tagi – kolekcja `predefinedTags` (en/pl) jako podpowiedzi obok tagów własnych. Zmienia D36.

## Publikacja i strona publiczna

- **D11** Szczegóły udostępniania – `shareToken`, linki do udostępniania. Zastąpiona przez D38 (obowiązuje D38).
- **D38** Publikacja zamiast udostępniania linkiem – `folders.published` i `stories.publication`, adresy `/p/<nick>/<folder>/<rozdział>`. Zmieniona w D54.
- **D42** Publiczna wyszukiwarka, strona główna i sidebar – `/` to wyszukiwarka i sidebar dla zalogowanych. Zmieniona w D54, D50, D80.
- **D47** Publiczny link bez prefiksu języka – link `/p/nick/folder` bez locale, język z przekierowania proxy.
- **D54** Strona główna z hero i ostatnio opublikowanymi – hero dla gościa, `stories.publishedAt`, wąski ekran. Zmienia D38, D42, D46.

## Eksport i import

- **D10** Format eksportu `.md` – frontmatter YAML generowany bez biblioteki, daty ISO.
- **D18** Eksport i udostępnianie folderu – zip z rozdziałami przez `fflate`. Część o udostępnianiu zastąpiona przez D38.
- **D31** Eksport do nowych formatów w przeglądarce – docx, odt, pdf, epub, fb2, html, txt, md.
- **D32** Zip z osobnym plikiem na rozdział – przełącznik „One file per chapter (.zip)” w dialogu eksportu.
- **D33** Tylko przycisk „Export as…” – przyciski Export .md i .zip usunięte z UI.
- **D34** Import opowiadań – formaty jak w eksporcie plus zip, plik do 50 MB, parsowanie w przeglądarce.

## UI i i18n

- **D6** Motyw bez dodatkowych pakietów – inline skrypt w `<head>`, klasa `dark`, bez `next-themes`.
- **D29** Menu konta zamiast górnego paska – górny pasek usunięty. Zastąpiona przez sidebar z D42.
- **D46** Wielojęzyczny interfejs z prefiksem w adresie – next-intl, en i pl, aplikacja publiczna. Zmieniona w D54.
- **D48** Słownik i komunikaty generowane – pliki `messages/*.json`, brakujący klucz to błąd `tsc`.
- **D49** Przełącznik języka i język po zalogowaniu – menu języków w sidebarze, nazwy we własnych językach.
- **D50** Dialog ustawień – motyw, język, hasło i wylogowanie w jednym dialogu „Settings”. Zmieniona w D80 (nowe ustawienia).
- **D52** Łagodniejszy kontrast i jeden motyw kolorystyczny – mniejszy kontrast przy zachowaniu WCAG AA.
- **D53** Tooltipy przy przyciskach z samą ikoną – shadcn Tooltip zamiast `title`. Częściowo zmieniona w D55.

## Serwer narzędzi, korekta i słowniki

- **D43** Generator nazw – działa w przeglądarce, sylaby z tabel głosek, bez AI.
- **D44** Język folderu w tasku LanguageTool – zakres taska 31 wchłonięty przez task 29. Zmieniona w D58.
- **D41** Zakładka Tools – trzeci panel boczny w edytorze. Zmieniona w D51 (bez Split).
- **D56** Serwer narzędzi lokalnie w Dockerze, flaga po zmiennych – Coolify i serwer docelowy w Dockerze (task 54).
- **D57** Lokalny serwer narzędzi: polecenia, konto, proxy – `npm run up`/`down`, konto, proxy.
- **D58** LanguageTool na serwerze narzędzi i język folderu – tekst do korekty tylko na własny serwer, na żądanie. Zmienia D21, D44.
- **D59** Korekta w dialogu w stylu propozycji zmian – dialog, panel, Accept. Zastąpiona przez D66 (sprawdzanie i mapowanie pozycji obowiązują).
- **D60** Słownik użytkownika w korekcie – słownik per konto w `settings.proofreading.dictionary`.
- **D61** Serwis słownikowy i tabela form – PoliMorf jako tabela form, serwis słownikowy (task 25).
- **D62** Definicje z Wikisłownika – kafelek Definitions, polska edycja z kaikki.org (task 32).
- **D63** Synonimy z Wikisłownika i Dobrego słownika – kafelek Synonyms, źródła wybrane po pomiarach (task 33).
- **D64** Rymy z kluczy fonetycznych tabeli form – kafelek Rhymes, `lib/tools/rhyme-key.ts` (task 34).
- **D65** Filtry rymów – filtr części mowy i zakres sylab, filtrowanie w SQL, limit 150 (task 35).

## Okładki i 18+

- **D67** Oznaczenie 18+ – pole `adult { manual, auto }` na folderze i rozdziale, filtr automatyczny (task 65). Częściowo zmieniona w D80 (18+ admina).
- **D68** Okładki folderów: decyzje przy starcie taska 26 – limity okładek, `COVERS_MAX_TOTAL_MB`, kopia przed migracją (zmienia D14).
- **D69** Wyświetlanie okładek – rozmiary miniatur na listach i stronach, rozmycie okładek 18+ (task 40).

## Proces, branche, testy, wdrożenie

- **D2** Strategia testów – unit, integracyjne na MongoDB w Dockerze, E2E Playwright; każde kryterium ma test lub `manual`.
- **D3** MongoDB w Dockerze dla testów i lokalnego dev – kontener `mongo:8`, osobne bazy testowe, start w `globalSetup`.
- **D5** Uruchamianie E2E – Playwright z `next build` + `next start` na porcie 3100, osobny `distDir`.
- **D13** Branche i środowiska po wersji 1.0 – tag `v1.0.0`, `staging` i `main`, osobna baza stagingu. Zmieniona w D15, D45.
- **D14** System migracji – własny mechanizm `migrations/NNN-*.ts`, kopia przed migracją. Zmieniona w D68.
- **D15** Branch `develop` – przepływ feature → `develop` → `staging` → `main`. Częściowo zmieniona w D45.
- **D26** Lokalny backup bazy – `scripts/backup.sh` (bash + Docker) zamiast skryptu `tsx`.
- **D45** Claude nie merguje do `staging` i `main` – merge i push na te branche robi tylko użytkownik. Zmienia D15.
- **D81** Narzędzia Claude do UX i UI – skille `frontend-design`, `ux-heuristics`, `web-design-guidelines`, MCP `shadcn` i `playwright`, bez Claude in Chrome.

## System społecznościowy

- **D80** System społecznościowy (taski 68–91, branch `feature/social`) – profile, relacje, komentarze, DM, fora, role i bany; zmienia D1, D37, D42, D50, D67, D79. Czytaj zawsze `scope.md` i `roles-bans-blocks.md` oraz plik obszaru taska.
  - `docs/decisions/d80/scope.md` – zakres i zasady ogólne, rozstrzygnięcia bez taska i z taska 91.
  - `docs/decisions/d80/roles-bans-blocks.md` – role, bany, blokady (taski 69, 79, 80, 86).
  - `docs/decisions/d80/profile-relations-library.md` – profil, relacje, biblioteka (taski 70, 71, 72, 73, 74).
  - `docs/decisions/d80/text-interactions.md` – interakcje z tekstem (taski 76, 77, 78, 82).
  - `docs/decisions/d80/notifications-dm-realtime.md` – powiadomienia, DM, realtime (taski 81, 85, 90).
  - `docs/decisions/d80/stats-discovery.md` – statystyki i odkrywanie (taski 75, 83, 84).
  - `docs/decisions/d80/forums-admin.md` – fora i panel admina (taski 87, 88).
  - `docs/decisions/d80/account.md` – konto, w tym usuwanie konta (task 89).
  - `docs/decisions/d80/navigation.md` – nawigacja (bez przypisanego taska).
  - `docs/decisions/d80/process.md` – przebieg i branche (autorun, merge do `feature/social`).
