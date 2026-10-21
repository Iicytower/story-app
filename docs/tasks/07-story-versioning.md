# 07 – Wersjonowanie folderów

Ustalenia z użytkownikiem (2026-10-21):
- Wersja obejmuje cały folder: rozdziały, ich kolejność i notatki folderu.
- Wersje tworzy się tylko ręcznie. Jedynym wyjątkiem jest wersja zapisywana automatycznie przed przywróceniem.
- Przywracać można wybrane rozdziały: jeden, kilka albo wszystkie.
- Każda wersja ma wymaganą nazwę i numer porządkowy. Numer nie jest używany ponownie po usunięciu wersji.
- Wersje można usuwać.
- Porównanie z bieżącym tekstem używa pakietu `diff`.

## Zakres

- **Model.**
  - Kolekcja `folderVersions`: `userId`, `folderId`, `number`, `name`, `folderNotes`, `chapters` (`storyId`, `title`, `position`, `contentId`), `createdAt`. Unikalny indeks `{ folderId, number }`.
  - Kolekcja `chapterContents`: `userId`, `storyId`, `title`, `content`, `notes`, `hash`. Jeden dokument na stan rozdziału, więc duży folder nie zbliża się do limitu 16 MB dokumentu.
  - Rozdział, który nie zmienił się od poprzedniej wersji (ten sam `hash`), wskazuje istniejący dokument zamiast tworzyć kopię.
  - Każde zapytanie filtruje po `userId` z sesji. Cudza wersja albo wersja usuniętego folderu daje `NOT_FOUND`.
- **Numer.** Kolejny w obrębie folderu: maksymalny dotąd użyty numer + 1. Licznik jest w folderze (`versionCounter`, `$inc`), więc po usunięciu wersji numer nie wraca, a dwa równoległe zapisy nie dostaną tego samego.
- **Zapis wersji.** Na stronie folderu przycisk „Save version” otwiera dialog z wymaganą nazwą (po `trim()`, limit długości).
  - Wersja zapisuje rozdziały w stanie z bazy, więc niezapisane zmiany w otwartym edytorze nie wchodzą.
  - Na stronie folderu nie ma edytora rozdziałów. Problem może dotyczyć tylko notatek folderu, więc ich zapis jest wymuszany przed utworzeniem wersji.
- **Lista wersji** na stronie folderu: numer, nazwa, data, liczba rozdziałów.
- **Podgląd wersji.**
  - Lista rozdziałów z tej wersji z oznaczeniami: „changed”, „unchanged”, „deleted since” (rozdział usunięty albo przeniesiony do innego folderu) i „added since” (bieżący rozdział, którego w wersji nie było; tylko informacyjnie).
  - Dla zmienionego rozdziału porównanie z bieżącym tekstem słowo po słowie (pakiet `diff`, dodane i usunięte fragmenty podświetlone). Osobno treść, tytuł i notatki rozdziału.
- **Przywracanie.**
  - Checkboxy przy rozdziałach z wersji plus „Select all”, potem „Restore selected”.
  - Najpierw automatycznie powstaje wersja z kolejnym numerem i nazwą „Before restoring version N”, więc przywrócenie da się cofnąć.
  - Rozdział, który nadal jest w folderze: tytuł, treść i notatki wracają ze stanu z wersji. Tak jak w `saveStory` zmienia się `updatedAt`, więc otwarty edytor dostanie konflikt zamiast nadpisać przywrócony tekst.
  - Rozdział usunięty od tamtej pory albo przeniesiony gdzie indziej: tworzony na nowo w tym folderze, na końcu listy.
  - Konflikt tytułu z istniejącym rozdziałem: sufiks „ (2)”, jak w migracji 002.
  - Notatki folderu i kolejność rozdziałów nie są przywracane, bo dotyczą całego folderu, a nie wybranych rozdziałów.
- **Usuwanie wersji:** dialog potwierdzenia. Dokumenty `chapterContents`, na które nie wskazuje już żadna wersja, są usuwane.
- **Poza wersjami:** eksport i strony publiczne nie pokazują wersji. Usunięcie folderu (soft delete) zostawia wersje w bazie, ale są niedostępne.
- **Pakiet.** `diff` do zainstalowania podczas implementacji (zgoda: 2026-10-21).
- **Dokumentacja.** Decyzja w `decisions.md`. Zmienia spec („Brak historii wersji”).

## Kryteria akceptacji

1. „Save version” z nazwą tworzy wersję z kolejnym numerem; bez nazwy zapis jest zablokowany.
2. Numer nie jest ponownie używany po usunięciu wersji; dwa równoległe zapisy dostają różne numery.
3. Wersja zawiera stan wszystkich aktywnych rozdziałów folderu (tytuł, treść, notatki, kolejność) i notatki folderu z chwili zapisu.
4. Podgląd pokazuje rozdziały z wersji ze statusem i porównanie zmienionego rozdziału z bieżącym tekstem.
5. Przywrócenie wybranych rozdziałów (jednego, kilku, wszystkich) przywraca tylko je. Usunięty rozdział wraca do folderu. Przedtem powstaje wersja „Before restoring version N”.
6. Otwarty edytor przywracanego rozdziału nie nadpisuje przywróconego tekstu (konflikt).
7. Usunięcie wersji wymaga potwierdzenia i nie zmienia pozostałych wersji ani rozdziałów.
8. Wersje innego użytkownika i usuniętego folderu są niedostępne (`NOT_FOUND`).

## Testy

- **Jednostkowe:** porównanie wersji (statusy changed / unchanged / deleted / added), tytuł z sufiksem przy konflikcie, walidacja nazwy (1, 4, 5).
- **Integracyjne** (Server Actions na MongoDB z Dockera):
  - kryteria 1–3, 5, 7 i 8;
  - deduplikacja `chapterContents` przez `hash`;
  - równoległe zapisy wersji;
  - przywrócenie usuniętego i przeniesionego rozdziału;
  - sprzątanie treści po usunięciu wersji.
- **E2E:**
  - zapis wersji z nazwą, zmiana rozdziału, podgląd z porównaniem, przywrócenie jednego, a potem dwóch rozdziałów, wersja „Before restoring…” na liście (1, 4, 5);
  - konflikt w otwartym edytorze po przywróceniu (6);
  - usunięcie wersji z potwierdzeniem (7).
