# 29 – LanguageTool na serwerze, akcja sprawdzania i język folderu

Wynik researchu. Silnik dla dialogu z taska 23. Zawiera dawny task 31 (D44).

## Zakres

- Kontener LanguageTool 6.8 jako usługa za bramką na lokalnym serwerze z taska 54 (ścieżka `/lt` w bramce), wdrażana przez Coolify tak jak bramka.
- Wspólny klient serwera narzędzi po stronie serwera (`TOOLS_API_URL`, `TOOLS_API_SECRET`, nagłówek `X-Tools-Secret`) i flaga z D56: bez obu zmiennych akcja zwraca `{ ok: false, ... }` z kodem „narzędzie niedostępne”, bez wywołania sieci. Z klienta i flagi korzystają taski 23, 25 i 32–34.
- Server Action sprawdzająca rozdział: sesja, własność, wynik `{ ok, ... }`.
- Tekst wysyłany w parametrze `data` z adnotacją tekst/markup, z podziałem na akapity.
- Parametry `language=pl-PL`, `enabledRules=PL_WORD_REPEAT` oraz wyłączone reguły z taska 23.
- Wynik w postaci niezależnej od LT: pozycja w źródle, rodzaj, opis, podpowiedzi, id reguły.
- Język ustawiany per folder, obowiązujący dla jego rozdziałów i notatek. Istniejące i nowe foldery domyślnie mają polski.
- Pisownia sprawdzana na bieżąco według języka folderu: atrybut `lang` z folderu na polach tekstu (treść, notatki rozdziału i folderu, tytuły) zamiast wpisanego na stałe `lang="pl"`.
- Język folderu przekazywany do LT w parametrze `language`.

## Ustalenia

- Serwer działa bez polskich n-gramów, których nie ma w oficjalnych paczkach.
- Tekst opowiadania trafia tylko na własny serwer. Zmienia to D21 (decyzja przy realizacji).
- Pisownia na bieżąco: przeglądarka z `lang`, bez nowych pakietów (decyzja użytkownika, D44). Zależy od słowników i ustawień przeglądarki.
- Kafelki słownikowe i eksport bez zmian: język dotyczy tylko edytora i LT (D44).

Do decyzji przy starcie taska:

- Limit czasu wywołania. Propozycja: 30 s, po sprawdzeniu limitu funkcji na Vercelu i pomiarze lokalnie z limitem CPU jak na Mikrusie (ponowny pomiar w tasku 28), bo test na 1 CPU go przekroczył (sekcja „Test na Coolify”).
- Limit rozmiaru treści akcji (`bodySizeLimit`) dla najdłuższych rozdziałów.
- Obraz Dockera (`erikvl87/languagetool` albo `meyay/languagetool`). `-Xmx` co najmniej 512 MB po teście na Coolify.
- Lista języków. Na 2026-11-02 tylko polski, bez angielskiego (decyzja użytkownika); przy jednym języku ustalić, czy powstaje selektor, czy samo pole. Inne języki wymagają reguł LT dobranych pod język (dziś `PL_WORD_REPEAT` i wyłączenia z taska 23) i pomiaru pamięci.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### LanguageTool dla polskiego

- Open source, LGPL 2.1, opiekun polskiego Marcin Miłkowski. 6.8 z 2026-05-05 ma 1765 reguł aktywnych, 14 domyślnie wyłączonych.
- Kategorie: ortografia, interpunkcja, odmiana, składnia, szyk, frazeologia, leksyka, fonetyka, rodzaj, typografia, pleonazmy, wyrazy modne, wielkość liter, liczby, literówki.
- Reguły Java: `MORFOLOGIK_RULE_PL_PL`, `PL_WORD_REPEAT` (domyślnie wyłączona), `WORD_REPEAT_RULE`, `PL_SIMPLE_REPLACE`, `PL_COMPOUNDS`, `PL_WORD_COHERENCY`, `DASH_RULE`, `PL_UNPAIRED_BRACKETS`.
- Reforma ortografii 2026 jest dopiero w 6.9 (niewydane, [issue #11684](https://github.com/languagetool-org/languagetool/issues/11684) zamknięte 2026-08-20). Rytm wydań: 2025-03, 2025-10, 2026-05. Moment przejścia do ustalenia po wydaniu.
- N-gramy: brak w oficjalnych paczkach, zbiór PWr (7 GB, CC BY-SA) nieprzerobiony na format LT.
- Obrazy: `erikvl87/languagetool` (6.8, 2026-06-15), `meyay/languagetool` (6.8-14, 2026-10-29), oba bez reformy.
- Tryb `level=picky` na próbce nie zmienił wyniku.

### Wyniki testu (`org.languagetool:language-pl:6.8`)

- Wydajność ~6100 słów: 5,9 s na zimno, ~3 s na ciepło, inicjalizacja ~1,5 s. Działa z `-Xmx256m`, szczytowe RSS ~335 MB w trybie biblioteki. Serwer HTTP potrzebuje więcej, patrz „Test na Coolify”.
- Sklejone linie dają fałszywe alarmy, więc tekst musi mieć `\n\n` albo iść blok po bloku.
- Hałaśliwa reguła do oceny: `ZDANIA_ZLOZONE`.
- Wykrywa pisownię, pisownię łączną, interpunkcję, pleonazmy, odmianę i składnię. Złe podpowiedzi: Wogóle → „Ogóle”, Przyszłem → „Przyszłej”. Przeocza m.in. Poszłem, na rozcież, ogromna ilość ludzi, powtórzenia między zdaniami.
- Fałszywe alarmy: „Brak przecinka w zdaniu złożonym” przez kropkę, imiesłów bez orzeczenia po nierozpoznanym „Poszłem”. Potoczne kwestie i myślniki dialogowe bez szumu.

### Test na Coolify (2026-11-01)

Serwer HTTP w kontenerze `erikvl87/languagetool:latest`, wersja 6.8 z 2026-06-15, `mem_limit: 800m`, `-Xms128m`. Konfiguracja usługi i bramki: task 54.

Tekst: fragmenty *Pana Tadeusza*, 6001 słów (41 397 bajtów, 653 uwagi) i 19 995 słów (140 105 bajtów, 2309 uwag), w blokach po 4 wiersze rozdzielonych `\n\n`. Parametry: `text`, `language=pl-PL`, `enabledRules=PL_WORD_REPEAT`. Liczba uwag była taka sama w każdej konfiguracji. Każdy czas to jedna próba, a seria szła od pierwszego żądania po starcie.

| Konfiguracja **[pomiar]** | 6000 słów: 1. | 2. | 3. | 20 000 słów | RSS |
| --- | --- | --- | --- | --- | --- |
| `-Xmx512m`, bez limitu CPU (8 rdzeni) | 14,3 s | 6,6 s | 5,8 s | 17,3 s | 473 MB przed, ok. 658 MB po |
| `-Xmx512m`, `cpus: 1` | 65,9 s | 23,0 s | 18,0 s | 31,4 s | 583–666 MB |
| `-Xmx512m`, `cpus: 0.5` | 152,6 s | 38,0 s | nie mierzono | nie mierzono | 629–643 MB |
| `-Xmx256m`, bez limitu CPU | 40,7 s | 33,5 s | nie mierzono | 176,0 s | 469–487 MB, bez OOM i restartów |

**[wniosek]**

- `-Xmx256m` nie wystarcza do pracy serwera, bo tekst sprawdza się kilka razy wolniej. Potrzeba co najmniej 512 MB, a limit kontenera 800 MB zostawia niewielki zapas.
- Limit 30 s jest ryzykowny. Na 1 CPU przekracza go pierwsze żądanie po starcie i rozdział 20 000 słów, a na 0,5 CPU także 6000 słów na ciepło. Mikrus nie gwarantuje mocy CPU, a limity 1 i 0,5 to założenia testu. Limit trzeba zmierzyć lokalnie z limitem CPU i potwierdzić na Mikrusie (task 28).
- Po starcie kontenera trzeba rozgrzać LT, bo pierwsze żądanie jest kilka razy wolniejsze.
- Obraz przypiąć do wersji zamiast `:latest`.

Parametr `data` **[pomiar]**: na próbce z `**` i `# ` „bląd” ma offset 10, czyli pozycję w źródle ze znacznikami, a znaczniki nie były zgłaszane. `MORFOLOGIK_RULE_PL_PL`, `WORD_REPEAT_RULE` i `PL_WORD_REPEAT` zgłosiły błędy. Dla „Kot kot” jest podpowiedź „Kot”, a `PL_WORD_REPEAT` nie daje podpowiedzi.

### API

- Parametr `data` przyjmuje adnotację tekst/markup, a pozycje błędów liczy względem całego źródła.
- Parametry per żądanie: `language=pl-PL`, `enabledRules`, `disabledRules`, opcjonalnie `level`.
- Tekst opowiadania trafia tylko na własny serwer.

### Odrzucone silniki

| Opcja | Powód |
| --- | --- |
| Publiczne API LT | „Do not send automated requests”, 20 żądań/min/IP jako szczyt, 75 KB/min, 20 KB/żądanie, podpowiedzi dla 30 literówek, współdzielone IP Vercela |
| LT Premium | abonament, cena [do weryfikacji]; 80 żądań/min, 60 000 znaków/żądanie |
| LLM | decyzja użytkownika: niedeterministyczne, nadmierne poprawianie, brak pozycji, koszt, tekst u firmy. Claude ok. $0,10–0,15 za rozdział na Opus 5.5, Bielik 11B ok. 0,67 $/1M [do weryfikacji]. Do ewentualnego testu: `ermlab/polish-gec-datasets` |
| iKorektor | 5000 znaków/żądanie, 15 000 dziennie [do weryfikacji], zwraca poprawiony tekst bez pozycji |
| Sapling | firma z USA, cena [do weryfikacji] |
| TextGears, ML Kit | brak polskiego |
| CLARIN-PL Punctuator | tylko wstawia interpunkcję |
| Chrome Proofreader API | origin trial, tylko Chrome desktop |
| GoodWrite, Ortograf, Polszczyzna.pl, korektortekstu.pl | brak udokumentowanego API |
| Hunspell | tylko pisownia |

Źródła: [CHANGES.md](https://github.com/languagetool-org/languagetool/blob/master/languagetool-standalone/CHANGES.md), [grammar.xml](https://github.com/languagetool-org/languagetool/blob/master/languagetool-language-modules/pl/src/main/resources/org/languagetool/rules/pl/grammar.xml), [docker-languagetool](https://github.com/Erikvl87/docker-languagetool).

### Język folderu

Modele nie mają pola `lang`, a `lang="pl"` jest wpisane na stałe w `components/markdown-editor.tsx` oraz w polach tytułu. Migrację robić jak D14; w bazie tylko wybrane wartości, brak pola oznacza polski.

- Hunspell pl_PL z sjp.pl: tylko pisownia, aktualizowany co miesiąc (pakiet 20260401), zgodność z reformą 2026 niepotwierdzona. GPL 2 / LGPL 2.1 / MPL 1.1 / Apache 2.0 / CC BY 4.0.
- npm: `dictionary-pl` 2.0.0 (dane z 2008 r.), `@cspell/dict-pl_pl` 3.0.8 (2026-10-13, lista słów), `nspell` 2.1.5 (2021), `hunspell-wasm` 0.3.0 (2024). Nowe pakiety wymagają zgody.
- LT nie nadaje się do sprawdzania na bieżąco: jedno sprawdzenie to sekundy, a Server Actions wstrzymują autozapis.

Inne języki w narzędziach:

- Definicje: najtaniej, jeden ekstrakt kaikki na język (edycje oznaczone jako „work in progress”).
- Synonimy: nowe źródło na język (en: WordNet, Datamuse; de: OpenThesaurus, CC BY-SA 4.0 lub LGPL 2.1).
- Rymy: poza angielskim brak darmowego API. Datamuse tylko en/es, klucz wymagany od 2027 r.
- Lematyzacja: najdrożej, osobne dane morfologiczne na język.
- `dictionaryapi.dev` odpada dla każdego języka: niejasne prawa do danych.

## Kryteria akceptacji

1. Rozdział właściciela zwraca błędy z pozycjami zgodnymi ze źródłem markdown.
2. Znaczniki markdown nie są zgłaszane jako błędy.
3. Sprawdzanie cudzego rozdziału daje `NOT_FOUND`, a bez sesji odmowę.
4. Treść bierze akcja z bazy po `id` rozdziału albo po weryfikacji własności, a `userId` nigdy nie pochodzi od klienta.
5. Niedostępny silnik i przekroczony czas dają `{ ok: false, ... }`.
6. Powtórzenie słowa w zdaniu jest zgłaszane.
7. Sekret i adres nie trafiają do klienta.
8. Folder bez ustawionego języka działa jak polski, także po migracji.
9. Język folderu obowiązuje we wszystkich jego rozdziałach i notatkach: w atrybucie `lang` pól i w parametrze `language` żądania do LT.
10. Zmiana języka cudzego folderu daje `NOT_FOUND` (o ile powstanie zapis języka).
11. Bez `TOOLS_API_URL` albo `TOOLS_API_SECRET` akcja zwraca błąd „narzędzie niedostępne” bez wywołania sieci (D56).

## Testy

Unit: budowa `data` z markdownu, mapowanie odpowiedzi LT, normalizacja języka. Integracyjne: sesja, własność, błędy, timeout (silnik zastąpiony atrapą, bez sieci), brak zmiennych (flaga), zapis języka, migracja. E2E: atrybut `lang` pól. `manual`: rozdział ok. 6000 słów na lokalnym serwerze z taska 54, czas i RAM; zaznaczanie literówek w przeglądarce.
