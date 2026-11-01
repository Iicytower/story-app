# 38 – Publikacja opowiadań

Wydzielone z dawnego taska 24 (zgłoszenie z 2026-10-30). Publikacja zmienia założenie, że opowiadanie widzi tylko ktoś, kto zna link (D11, D18).

## Zakres

- Przełącznik „Publish” na rozdziale i folderze, niezależny od „Share”. Domyślnie wyłączony, także dla wszystkiego, co ma dziś aktywny link.
- Strona czytania opublikowanego opowiadania z podpisem autora.

## Ustalenia

- Publiczne jest tylko to, co autor opublikował osobną zgodą. Aktywny link niczego nie publikuje (decyzja użytkownika).
- Autor to nick z taska 36 (decyzja użytkownika).

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Czy rozdział w opublikowanym folderze jest publiczny razem z nim, czy wymaga własnej zgody.
- Adres strony czytania: token z „Share” czy osobny adres, skoro „Publish” działa bez „Share”.
- Czy strony są indeksowane przez wyszukiwarki, czy zostają przy `noindex`.

## Kryteria akceptacji

1. Po migracji nic nie jest opublikowane, a aktywne linki działają jak dotąd.
2. „Publish” udostępnia stronę czytania, a wyłączenie ją zabiera; „Share” i „Stop sharing” tego nie zmieniają.
3. Usunięty rozdział lub folder (`deletedAt`) przestaje być dostępny.
4. Treść publiczna nie zawiera komentarzy (`stripComments`) ani notatek, a strona pokazuje nick i nie ujawnia `userId`.
5. Publikować może tylko właściciel; cudze opowiadanie daje `NOT_FOUND`.
6. Eksport, wersje folderów i `updatedAt` rozdziałów nie zmieniają się przez „Publish”, chyba że decyzja przy starcie stanowi inaczej.

## Testy

Unit: zawartość strony bez danych prywatnych. Integracyjne: akcje, własność, migracja, widoczność, `deletedAt: null`. E2E: publikacja, czytanie bez logowania, wyłączenie, usunięcie.
