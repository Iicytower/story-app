# 25 – Słowniki

Zgłoszenie użytkownika (2026-10-30). Podręczne słowniki przy pisaniu, bez wychodzenia z edytora.

## Zakres

- Zakładka „Dictionary” w panelu bocznym edytora obok Notes / Chapters, a na wąskim ekranie obok Story / Notes / Chapters (D12, D19).
- Słowa szukane przez wpisanie w zakładce albo wysłanie zaznaczonego słowa z `MarkdownEditor`.
- Słowniki: synonimy, rymy, definicje (SJP), odmiana.
- Podmiana zaznaczonego słowa wynikiem jednym kliknięciem, w treści rozdziału, notatkach rozdziału i notatkach folderu.

## Ustalenia

- Lista czterech słowników jest wstępna; ostateczny zestaw zależy od dostępnych źródeł (decyzja użytkownika).

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Ostateczny zestaw słowników i źródło danych każdego z nich: dane w aplikacji albo zewnętrzne API. Porównanie obejmuje licencję, kompletność dla polskiego, koszt, limity i rozmiar danych (Atlas M0, paczka klienta).
- Sposób odpowiedzi serwera (Route Handler albo Server Action), bo CLAUDE.md ogranicza Route Handlery do eksportu i Auth.js, a odczyt z klienta ich nie zastępuje.
- Języki: tylko polski czy język folderu, jeśli task 23 będzie już zrobiony.
- Czy synonim zachowuje formę zaznaczonego słowa (odmiana), czy wstawia formę podstawową.
- Czy trzymać pamięć podręczną zapytań.

## Kryteria akceptacji

1. Zakładka „Dictionary” jest dostępna na desktopie (także w Split) i na wąskim ekranie, a jej otwarcie nie gubi stanu edytora (D27).
2. Wpisane słowo daje wyniki z każdego dostępnego słownika, a brak wyników daje komunikat.
3. Zaznaczone słowo można wysłać do zakładki z każdego `MarkdownEditor`, w Preview i Source.
4. Kliknięcie wyniku podmienia zaznaczone słowo, jest cofane jednym Undo i zapisuje się autozapisem.
5. Bez zaznaczenia wynik nie zmienia tekstu, można go tylko skopiować.
6. Słowa odmienione (np. „kota”) znajdują hasło podstawowe, o ile pozwala na to źródło.
7. Niedostępne źródło lub przekroczony limit daje komunikat i nie blokuje edycji ani zapisu.
8. Do źródła trafia tylko szukane słowo, nigdy tekst opowiadania, a klucze API nie trafiają do klienta.
9. Działanie wymaga zalogowania.

## Testy

Unit: wybór słowa z zaznaczenia, normalizacja zapytania, mapowanie wyników źródeł. Integracyjne: wyszukiwanie w słownikach, sesja, obsługa błędów źródła (źródła zastąpione atrapą, bez wywołań sieciowych). E2E: zakładka, wysłanie zaznaczonego słowa, podmiana z Undo i autosave. `manual`: kompletność wyników prawdziwych źródeł dla polskiego.
