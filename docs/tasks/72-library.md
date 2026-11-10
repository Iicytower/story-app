# 72 – Biblioteka i półki

Subtask 68, zależy od 70. Podstawa: D80 (Profil, relacje, biblioteka – biblioteka). Branch `feature/72-library` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcje `shelves` (`userId`, `name` do 50 znaków, `order`, `createdAt`; najwyżej 20 na konto) i `libraryItems` (`userId`, `folderId`, `shelfIds: ObjectId[]`, `addedAt`; unikalny para `userId`+`folderId`).
- Trzy półki startowe „Czytam”, „Na później”, „Przeczytane” tworzone leniwie przy pierwszym wejściu do biblioteki (nazwy w języku interfejsu w chwili utworzenia); można je zmieniać i usuwać jak własne. Utworzenie atomowo: `findOneAndUpdate` znacznika `shelvesSeededAt` w profilu lub ustawieniach z `$exists: false`; tylko zwycięzca wstawia półki.
- Akcje: `addToLibrary(folderId, shelfIds)`, `removeFromLibrary`, `setItemShelves`, `createShelf`, `renameShelf`, `deleteShelf` (książki zostają w bibliotece), `reorderShelves`, `setLibraryPublic`. Tylko publiczne książki (D38); cudza półka → `NOT_FOUND`.
- Strona `/library` (zalogowany): półki jako zakładki, książki z okładką, autorem, 18+. Publiczna biblioteka na profilu (gdy `libraryPublic`), bez książek, które przestały być publiczne.
- Przycisk „Do biblioteki” z wyborem półek na publicznym spisie książki; pozycja „Biblioteka” w sidebarze włączona. Hak „dodano do biblioteki” dla powiadomień (81) i statystyk (83).
- Kolekcje taska dopisane do `purgeSocialData` (69); test: trwałe usunięcie rozdziału i folderu kasuje ich wpisy.

## Kryteria akceptacji

1. Dodanie, przeniesienie między półkami, usunięcie książki; książka na wielu półkach.
2. Półki startowe powstają raz; użytkownik je zmienia i usuwa; limit 20 półek.
3. Usunięcie półki nie usuwa książek z biblioteki.
4. Izolacja: akcje na cudzych półkach i pozycjach → `NOT_FOUND`.
5. Przełącznik prywatności ukrywa bibliotekę na profilu; publiczna pokazuje tylko publiczne książki.
6. Nieopublikowana lub usunięta książka znika z widoków biblioteki, a wraca po ponownej publikacji.
7. Gość klikający „Do biblioteki” dostaje dialog logowania (D42).

## Testy

- Integracyjne: `tests/integration/library.test.ts` (1–6).
- E2E: `tests/e2e/library.spec.ts` (7 – gość i dialog logowania; dodanie ze spisu, półki, prywatność widziana przez `erin`).
