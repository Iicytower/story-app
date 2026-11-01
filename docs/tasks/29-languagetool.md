# 29 – LanguageTool na serwerze i akcja sprawdzania

Wynik researchu. Silnik dla dialogu z taska 23.

## Zakres

- Kontener LanguageTool 6.8 na serwerze z taska 28.
- Server Action sprawdzająca rozdział: sesja, własność, wynik `{ ok, ... }`.
- Tekst wysyłany w parametrze `data` z adnotacją tekst/markup, z podziałem na akapity.
- Parametry `language=pl-PL`, `enabledRules=PL_WORD_REPEAT` oraz wyłączone reguły z taska 23.
- Wynik w postaci niezależnej od LT: pozycja w źródle, rodzaj, opis, podpowiedzi, id reguły.

## Ustalenia

- Serwer działa bez polskich n-gramów, których nie ma w oficjalnych paczkach.
- Tekst opowiadania trafia tylko na własny serwer. Zmienia to D21 (decyzja przy realizacji).

Do decyzji przy starcie taska:

- Limit czasu wywołania. Propozycja: 30 s, po sprawdzeniu limitu funkcji na Vercelu.
- Limit rozmiaru treści akcji (`bodySizeLimit`) dla najdłuższych rozdziałów.
- Obraz Dockera (`erikvl87/languagetool` albo `meyay/languagetool`) i `-Xmx`.

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

- Wydajność ~6100 słów: 5,9 s na zimno, ~3 s na ciepło, inicjalizacja ~1,5 s. Działa z `-Xmx256m`, szczytowe RSS ~335 MB w trybie biblioteki; serwer HTTP trochę więcej, w sumie ok. 350–450 MB.
- Sklejone linie dają fałszywe alarmy, więc tekst musi mieć `\n\n` albo iść blok po bloku.
- Hałaśliwa reguła do oceny: `ZDANIA_ZLOZONE`.
- Wykrywa pisownię, pisownię łączną, interpunkcję, pleonazmy, odmianę i składnię. Złe podpowiedzi: Wogóle → „Ogóle”, Przyszłem → „Przyszłej”. Przeocza m.in. Poszłem, na rozcież, ogromna ilość ludzi, powtórzenia między zdaniami.
- Fałszywe alarmy: „Brak przecinka w zdaniu złożonym” przez kropkę, imiesłów bez orzeczenia po nierozpoznanym „Poszłem”. Potoczne kwestie i myślniki dialogowe bez szumu.

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

## Kryteria akceptacji

1. Rozdział właściciela zwraca błędy z pozycjami zgodnymi ze źródłem markdown.
2. Znaczniki markdown nie są zgłaszane jako błędy.
3. Sprawdzanie cudzego rozdziału daje `NOT_FOUND`, a bez sesji odmowę.
4. Treść bierze akcja z bazy po `id` rozdziału albo po weryfikacji własności, a `userId` nigdy nie pochodzi od klienta.
5. Niedostępny silnik i przekroczony czas dają `{ ok: false, ... }`.
6. Powtórzenie słowa w zdaniu jest zgłaszane.
7. Sekret i adres nie trafiają do klienta.

## Testy

Unit: budowa `data` z markdownu, mapowanie odpowiedzi LT. Integracyjne: sesja, własność, błędy, timeout (silnik zastąpiony atrapą, bez sieci). `manual`: rozdział ok. 6000 słów na serwerze, czas i RAM.
