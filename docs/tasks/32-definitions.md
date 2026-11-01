# 32 – Definicje

Wynik researchu. Kafelek „Definitions” w Tools.

## Zakres

- Import definicji z `kaikki.org/plwiktionary` do SQLite (`lang_code == "pl"`).
- Czyszczenie: odsyłacze typu „od: zamek” i etykiety wyciekające do tekstu.
- Widok: pole wyszukiwania, znaczenia z częścią mowy i przykładami.
- Linki otwierane w nowej karcie: Wikisłownik, sjp.pl, PWN.

## Ustalenia

- Źródło: edycja polska na kaikki, nie domyślny „Polish” z angielskimi definicjami.
- Bez WSJP, bo wzorzec adresu nie jest zweryfikowany. Serwer niczego nie pobiera z linkowanych stron.
- Scrapowanie sjp.pl, PWN i WSJP odrzucone.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Dane

- Plik: [`kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz`](https://kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz), 137 850 838 bajtów, 1 022 150 wierszy we wszystkich językach. Aktualizacja „usually at least once a week”, zrzut z 2026-10-01.
- Po filtrze `lang_code == "pl"` **[pomiar]**: 126 183 haseł, 116 157 słów, 173 342 znaczeń, średnia definicja 47,5 bajta. Rzeczowniki 69 938, przymiotniki 22 502, czasowniki 12 501, nazwy 9369.
- Zwarty JSON (część mowy, numer znaczenia, definicja, tagi): 20 361 395 bajtów. Przykłady ma 67 429 znaczeń.
- Pola: `word`, `pos`, `senses[].glosses`, `sense_index`, `tags`, `examples`, `synonyms`, `antonyms`, `forms`, `sounds`.
- Pułapka: domyślny „Polish” na kaikki pochodzi z angielskiego Wiktionary i ma angielskie definicje.
- Czyszczenie: co najmniej 5608 znaczeń to odsyłacze („od: zamek”, „lp od: szybka”), etykiety wyciekają do tekstu (`gw. (Śląsk Cieszyński) dóm`).
- Jakość: „zaduma” → „głębokie zamyślenie”, jest „chatbot” i „smartfon”; słabe: „kapać” 1.2, „pierwszy” 1.1 → „od liczby 1”. Próba 13 słów przeszła, pokrycia literackiego nie zmierzono.
- Kaikki nie podaje licencji; CC BY-SA 4.0 dziedziczone po Wikisłowniku **[wniosek]**. Schemat może się zmieniać, a edycja polska to „work in progress”.

### Licencja Wikisłownika

[Warunki Wikimedia](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use): atrybucja przez link do użytej strony, zmienione dane na CC BY-SA 4.0 lub nowszej, oznaczenie zmian i informacja o licencji.

### Wzorce linków

- `https://pl.wiktionary.org/wiki/{word}`
- `https://sjp.pl/{word}`
- `https://sjp.pwn.pl/slowniki/{word}.html`
- WSJP: wzorzec niezweryfikowany, `/szukaj` zablokowane dla robotów.

Linki otwiera użytkownik. Serwer niczego nie pobiera ani nie osadza w `iframe`.

### Odrzucone źródła

| Źródło | Powód |
| --- | --- |
| sjp.pl | brak API, definicje bez licencji, otwarte są tylko listy słów. Kontakt: sjpslownik@gmail.com |
| SJP PWN, Doroszewski | regulamin: tylko własny użytek osobisty, zastrzeżenie TDM w `robots.txt` |
| WSJP (IJP PAN) | najlepsza jakość, brak API i licencji, ok. 84 tys. haseł; tylko po kontakcie z IJP PAN |
| Słowosieć | definicje tylko dla ok. 55% jednostek |
| Żywe API Wikimedia | parsowanie wikitekstu, limity od 2026, REST `page/definition` daje 501 |
| dictionaryapi.dev, Wordnik, Datamuse | brak polskich definicji |
| FreeDictionaryAPI.com | polskie słowa, angielskie definicje |

### Czy wolno zeskrapować sjp.pl

Nie bez zgody **[wniosek]**. Ustawa o ochronie baz danych (Dz.U. 2024 poz. 1769): pobranie całości narusza prawo producenta bazy, wyjątek użytku osobistego (art. 8) obejmuje tylko bazy nieelektroniczne, wyjątek TDM (art. 26³ pr. aut.) nie obejmuje słownika do wyświetlania. Definicje mogą być też utworami, a pobieranie słowo po słowie to szara strefa. Legalna droga: prośba do zespołu sjp.pl.

## Kryteria akceptacji

1. Wpisane słowo pokazuje definicje; forma odmieniona pokazuje „shown for: kot” i wyniki dla każdego lematu.
2. Brak wyniku daje komunikat, a linki zewnętrzne zostają dostępne.
3. Każda definicja ma link do hasła i informację „Wikisłownik, CC BY-SA 4.0”.
4. Odsyłacze form nie pojawiają się jako samodzielne definicje, o ile hasło ma lepsze znaczenia.
5. Wynik zostaje po przełączeniu zakładki.

## Testy

Unit: filtr i czyszczenie importu na próbkach, budowa linków. Integracyjne: akcja z atrapą serwisu. E2E: szukanie, brak wyniku, linki. `manual`: kompletność na prawdziwych danych.
