# 59 – Limity rozmiaru i liczby danych

Z testów bezpieczeństwa 2026-11-07 ([F5](../../security/pentest-2026-11-07.md#f5--brak-limitów-rozmiaru-i-liczby-danych-średnia)).

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

## Wynik (2026-11-10)

Decyzje: D72. Limity w `lib/limits.ts` (długości, komunikaty) i `lib/folders/limits.ts` (liczby). Sprawdzane w `createFolder`, `renameFolder`, `saveFolderNotes`, `createStory`, `saveStory`, `moveStory`, `importStories`, `createFolderVersion` i przywracaniu wersji. W UI `maxLength` w polach nazw i tytułów, a w edytorze komunikat pod treścią i blokada zapisu bez wysyłania żądania.

Mapowanie kryteriów:
1. Za długa nazwa/tytuł/treść/notatki → `INVALID_INPUT` z komunikatem (oba języki: klucze w `messages/en.json` i `pl.json`, brak klucza to błąd `tsc`), UI nie pozwala wpisać za długiej nazwy ani tytułu – `tests/integration/data-limits.test.ts` („length limits”), `lib/limits.test.ts`, E2E `tests/e2e/limits.spec.ts` (`maxlength`, wpisanie 205 znaków daje 200, komunikat przy zapisie za długiego tytułu), `tests/e2e/import.spec.ts` („refuses a chapter over the chapter limit”).
2. Limity liczby folderów, rozdziałów i wersji – `data-limits.test.ts` („count limits”).
3. Istniejące dane ponad limit da się otworzyć i skrócić – `data-limits.test.ts` („existing data over the limit opens and can be shortened”).
