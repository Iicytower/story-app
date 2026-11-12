# D63 – Synonimy z Wikisłownika i Dobrego słownika (2026-11-06)

Status: aktualna.

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
