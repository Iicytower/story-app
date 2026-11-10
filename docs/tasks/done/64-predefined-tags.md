# 64 – Predefiniowane tagi

Dziś tagi są w pełni dowolne (task [24](24-tags.md), D36), więc te same pojęcia zapisują się różnie (`sci-fi`, `science fiction`, `scifi`) i słabo nadają się do przeglądania między autorami. Task zaczął się jako koncepcyjny; po decyzjach użytkownika (D79) obejmuje też implementację.

## Zakres

- Kolekcja `predefinedTags` (`{ _id: klucz, labels: { en, pl } }`), lista startowa gatunków i form migracją `007-predefined-tags`, skrypt `npm run tags` do zmian.
- Lista predefiniowanych **plus** dowolne własne tagi, na folderach i rozdziałach. Zapis zamienia etykietę na klucz.
- UI: etykieta w języku interfejsu i odróżniony styl chipa, podpowiedzi w dialogu „Tags”, osobna grupa „Filtruj po kategorii” na `/stories` i w publicznej wyszukiwarce.
- Wyszukiwanie `q` (publiczne i `/stories`) pasuje do całego tagu i do etykiety predefiniowanego.
- Bez migracji istniejących tagów.

## Kryteria akceptacji

1. W `decisions.md` zapisana decyzja (D79): model (lista + dowolne), źródło (baza), zasięg (foldery i rozdziały), lista, plan migracji (brak, dopasowanie dokładne).
2. Migracja zasiewa poprawną listę z etykietami w obu językach i nie nadpisuje zmian przy ponownym uruchomieniu.
3. Skrypt odrzuca nieznormalizowany klucz, brakujące lub za długie etykiety i pisownię zajętą przez inny klucz.
4. Akcje tagów zapisują etykietę (w dowolnym języku) jako klucz, bez duplikatów; własne tagi bez zmian.
5. Tag predefiniowany wyświetla się etykietą w języku interfejsu i w odróżnionym stylu. Dialog to lista przełączników (najpierw wszystkie predefiniowane, potem własne), a pole podpowiada predefiniowane i publiczne tagi zawierające wpisany tekst, bez prywatnych tagów innych autorów.
6. `/stories` i publiczna wyszukiwarka mają osobną grupę filtrów kategorii; filtr używa klucza.
7. `q` znajduje rozdziały po całym tagu (własnym lub folderu) i po etykiecie predefiniowanego, na `/stories` i publicznie.

## Testy

- Unit: `lib/tags/predefined.test.ts` (kanonizacja, `tagsForQuery`, `labelOf`, walidacja wpisu, `matchingSuggestions`), `lib/publish/search.test.ts`, `lib/stories/search.test.ts` (filtry z `queryTags`).
- Integracyjne: `migration-007.test.ts`, `tags.test.ts` (akcje, `listStories` z `q`), `public-search.test.ts` (etykieta w `q`).
- E2E: `tags.spec.ts` (przełączniki, podpowiedzi z publicznych tagów bez prywatnych, wybór po etykiecie, chip, kategoria na `/stories`, `q` po polsku), `search.spec.ts` (grupa kategorii i etykieta w publicznej wyszukiwarce).
