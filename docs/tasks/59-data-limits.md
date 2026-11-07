# 59 – Limity rozmiaru i liczby danych

Z testów bezpieczeństwa 2026-11-07 ([F5](../security/pentest-2026-11-07.md#f5--brak-limitów-rozmiaru-i-liczby-danych-średnia)).

## Zakres

- Limity długości: nazwa folderu, tytuł rozdziału (jak `MAX_IMPORT_TITLE_LENGTH` 200), treść i notatki rozdziału, notatki folderu – sprawdzane w Server Actions i w UI (`maxLength`, komunikat). Limit treści rozdziału i notatek musi być poniżej progu z taska 62 (F8), żeby zapis nigdy nie kończył się 500.
- Limity liczby na użytkownika: foldery, rozdziały, wersje folderu (najstarsze usuwane czy blokada – do decyzji).
- Ewentualnie łączny limit danych użytkownika.

Do decyzji przy starcie taska (nowa decyzja w `decisions.md`): wartości limitów (z zapasem na długie powieści), zachowanie przy przekroczeniu liczby wersji, co z istniejącymi danymi ponad limit.

## Kryteria akceptacji

1. Zbyt długa nazwa/tytuł/treść/notatki zwraca `INVALID_INPUT` z komunikatem w obu językach, a UI nie pozwala jej wpisać.
2. Przekroczenie limitu liczby folderów, rozdziałów lub wersji daje komunikat zgodny z decyzją.
3. Istniejące dane ponad limit da się otworzyć i skrócić.

## Testy

Unit: walidacja długości. Integracyjne: każda akcja zapisu z wartością ponad limit, limity liczby. E2E: komunikat przy zbyt długim tytule.
