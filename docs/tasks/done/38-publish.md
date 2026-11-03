# 38 – Publikacja opowiadań

Wydzielone z dawnego taska 24 (zgłoszenie z 2026-10-30). Publikacja zmienia założenie, że opowiadanie widzi tylko ktoś, kto zna link (D11, D18).

## Zakres

- Przełącznik „Publish” na rozdziale i folderze, „Publish all” i „Unpublish” rozdziału.
- Strona czytania opublikowanego opowiadania z podpisem autora.
- Całkowite usunięcie „Share” (decyzja użytkownika). Szczegóły: D38.

## Kryteria akceptacji

1. Po wdrożeniu nic nie jest opublikowane, a stare linki `/s/...` nie działają.
2. „Publish” udostępnia stronę czytania, a wyłączenie ją zabiera.
3. Usunięty rozdział lub folder (`deletedAt`) przestaje być dostępny.
4. Treść publiczna nie zawiera komentarzy (`stripComments`) ani notatek, a strona pokazuje nick i nie ujawnia `userId`.
5. Publikować może tylko właściciel; cudze opowiadanie daje `NOT_FOUND`.
6. Eksport, wersje folderów i `updatedAt` rozdziałów nie zmieniają się przez „Publish”.
7. Publikacja jednego rozdziału nie zmienia ustawień pozostałych w opublikowanym folderze, a nowy rozdział jest w nim nieopublikowany.
8. Stary adres przekierowuje po zmianie tytułu lub nazwy folderu.

## Testy

Unit: zawartość strony bez danych prywatnych. Integracyjne: akcje, własność, migracja, widoczność, `deletedAt: null`. E2E: publikacja, czytanie bez logowania, wyłączenie, usunięcie.
