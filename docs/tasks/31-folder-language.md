# 31 – Język folderu i pisownia na bieżąco

Wydzielone z taska 23 (decyzja użytkownika, 2026-11-01). Do tego czasu zostaje spellcheck przeglądarki z `lang="pl"` (D21).

## Zakres

- Język ustawiany per folder, obowiązujący dla jego rozdziałów i notatek. Istniejące i nowe foldery domyślnie mają polski.
- Pisownia sprawdzana na bieżąco według języka folderu.
- Język folderu przekazywany do korekty (23, 29), jeśli obejmie ona inne języki.

Do decyzji przy starcie taska:

- Silnik pisowni na bieżąco: przeglądarka z `lang` z folderu czy słowniki w aplikacji. Przeglądarka zależy od słowników zainstalowanych u użytkownika, a pakiet `dictionary-pl` ma dane z 2008 r.
- Lista języków.
- Czy kafelki słownikowe pokazują się dla języka innego niż polski (dane są tylko polskie).

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Stan w kodzie

Modele nie mają pola `lang`, a `lang="pl"` jest wpisane na stałe w `components/markdown-editor.tsx`. Migrację robić jak D14; w bazie tylko wybrane wartości, brak pola oznacza polski.

### Silnik pisowni

- Przeglądarka: bez kosztów i bez wysyłania tekstu, ale zależy od zainstalowanych słowników.
- Hunspell pl_PL z sjp.pl: tylko pisownia, aktualizowany co miesiąc (pakiet 20260401), zgodność z reformą 2026 niepotwierdzona. GPL 2 / LGPL 2.1 / MPL 1.1 / Apache 2.0 / CC BY 4.0.
- npm: `dictionary-pl` 2.0.0 (dane z 2008 r.), `@cspell/dict-pl_pl` 3.0.8 (2026-10-13, lista słów), `nspell` 2.1.5 (2021), `hunspell-wasm` 0.3.0 (2024). Nowe pakiety wymagają zgody.
- LT nie nadaje się do sprawdzania na bieżąco: jedno sprawdzenie to sekundy, a Server Actions wstrzymują autozapis.

### Inne języki w narzędziach

- Definicje: najtaniej, jeden ekstrakt kaikki na język (edycje oznaczone jako „work in progress”).
- Synonimy: nowe źródło na język (en: WordNet, Datamuse; de: OpenThesaurus, CC BY-SA 4.0 lub LGPL 2.1).
- Rymy: poza angielskim brak darmowego API. Datamuse tylko en/es, klucz wymagany od 2027 r.
- Lematyzacja: najdrożej, osobne dane morfologiczne na język.
- `dictionaryapi.dev` odpada dla każdego języka: niejasne prawa do danych.

## Kryteria akceptacji

1. Język folderu można zmienić na stronie folderu; zmiana obowiązuje we wszystkich jego rozdziałach i notatkach.
2. Folder bez ustawionego języka działa jak polski, także po migracji.
3. Literówka jest zaznaczana na bieżąco zgodnie z językiem folderu, także innym niż polski.
4. Zmiana języka cudzego folderu daje `NOT_FOUND`.

## Testy

Unit: normalizacja języka. Integracyjne: zapis, własność, migracja. E2E: zmiana języka i atrybut `lang` pól. `manual`: zaznaczanie literówek w przeglądarce.
