# 07 – Wersjonowanie folderów

Ustalenia z użytkownikiem (2026-10-21):
- Wersja obejmuje rozdziały folderu (tytuł, treść) i ich kolejność z trybem sortowania. Notatki (rozdziałów i folderu) nie są częścią wersji.
- Wersje tworzy się tylko ręcznie. Jedynym wyjątkiem jest wersja zapisywana automatycznie przed przywróceniem.
- Przywracanie jak w gicie: cała wersja (`git reset --hard`) albo wybrane rozdziały (`git restore --source`), w tym usuwanie rozdziałów dodanych od tamtej pory.
- Każda wersja ma wymaganą nazwę i numer porządkowy. Numer nie jest używany ponownie po usunięciu wersji.
- Wersje można usuwać.
- Porównanie z bieżącym tekstem używa pakietu `diff`.

## Zakres

- **Model** (szczegóły w D25).
  - Kolekcja `folderVersions`: `userId`, `folderId`, `number`, `name`, `chapterSort`, `chapters` (`storyId`, `title`, `position`, `contentId`), `createdAt`. Unikalny indeks `{ folderId, number }`.
  - Kolekcja `chapterContents`: `_id` (hash stanu), `userId`, `storyId`, `title`, `content`, `usedAt`. Jeden dokument na stan rozdziału, więc duży folder nie zbliża się do limitu 16 MB dokumentu.
  - Rozdział, który nie zmienił się od poprzedniej wersji (ten sam hash), wskazuje istniejący dokument zamiast tworzyć kopię.
  - Każde zapytanie filtruje po `userId` z sesji. Cudza wersja albo wersja usuniętego folderu daje `NOT_FOUND`.
- **Numer.** Licznik w folderze (`versionCounter`, `$inc`), więc po usunięciu wersji numer nie wraca, a dwa równoległe zapisy nie dostaną tego samego.
- **Zapis wersji.** Na stronie folderu przycisk „Save version” otwiera dialog z wymaganą nazwą (po `trim()`, limit długości). Wersja zapisuje rozdziały w stanie z bazy, więc niezapisane zmiany w otwartym edytorze nie wchodzą.
- **Lista wersji** na stronie folderu: numer, nazwa, data, liczba rozdziałów.
- **Podgląd wersji.**
  - Rozdziały z oznaczeniami: „changed”, „unchanged”, „deleted since” (usunięty albo przeniesiony do innego folderu) i „added since” (bieżący rozdział, którego w wersji nie było).
  - Dla zmienionego rozdziału porównanie z bieżącym tekstem słowo po słowie (dodane i usunięte fragmenty podświetlone), osobno tytuł i treść.
- **Przywracanie.** Najpierw automatycznie powstaje wersja „Before restoring version N”, więc przywrócenie da się cofnąć. Po sukcesie przekierowanie do widoku folderu.
  - „Restore entire version” z potwierdzeniem i podsumowaniem: folder odpowiada wersji – zmienione i usunięte rozdziały wracają, dodane od tamtej pory są usuwane, wraca tryb sortowania i (w trybie manual) kolejność.
  - „Restore selected”: checkboxy plus „Select all”. Zaznaczony rozdział z wersji wraca, zaznaczony „added since” jest usuwany. Niezmienionych nie da się zaznaczyć. Kolejność bez zmian.
  - Rozdział, który nadal jest w folderze: tytuł i treść wracają, zmienia się `updatedAt` (jak w `saveStory`), więc otwarty edytor dostanie konflikt. Niezmieniony nie jest zapisywany.
  - Rozdział usunięty od tamtej pory wraca do folderu (ten sam dokument), przeniesiony gdzie indziej jest kopiowany jako nowy rozdział; oba na końcu kolejności ręcznej.
  - Konflikt tytułu z istniejącym rozdziałem: sufiks „ (2)”, jak w migracji 002.
- **Usuwanie wersji:** dialog potwierdzenia. Dokumenty `chapterContents`, na które nie wskazuje już żadna wersja, są usuwane.
- **Poza wersjami:** eksport i strony publiczne nie pokazują wersji. Usunięcie folderu (soft delete) zostawia wersje w bazie, ale są niedostępne.
- **Pakiet.** `diff` (zgoda: 2026-10-21).
- **Dokumentacja.** Decyzja D25 w `decisions.md`. Zmienia spec („Brak historii wersji”).

## Kryteria akceptacji

1. „Save version” z nazwą tworzy wersję z kolejnym numerem; bez nazwy zapis jest zablokowany.
2. Numer nie jest ponownie używany po usunięciu wersji; dwa równoległe zapisy dostają różne numery.
3. Wersja zawiera tytuł i treść wszystkich aktywnych rozdziałów folderu, ich kolejność i tryb sortowania z chwili zapisu; bez notatek.
4. Podgląd pokazuje rozdziały z wersji i dodane od tamtej pory ze statusem oraz porównanie zmienionego rozdziału z bieżącym tekstem.
5. Przywrócenie wybranych rozdziałów (jednego, kilku, wszystkich) przywraca tylko je; zaznaczone „added since” są usuwane. Usunięty rozdział wraca do folderu. Przedtem powstaje wersja „Before restoring version N”. Notatki zostają bez zmian.
6. Otwarty edytor przywracanego rozdziału nie nadpisuje przywróconego tekstu (konflikt).
7. Usunięcie wersji wymaga potwierdzenia i nie zmienia pozostałych wersji ani rozdziałów.
8. Wersje innego użytkownika i usuniętego folderu są niedostępne (`NOT_FOUND`).
9. Przywrócenie całej wersji (po potwierdzeniu) sprawia, że rozdziały folderu, ich kolejność i tryb sortowania odpowiadają wersji; rozdziały dodane od tamtej pory są usuwane, notatki zostają.

## Testy

- **Jednostkowe:** porównanie wersji (statusy changed / unchanged / deleted / added), podsumowanie pełnego przywrócenia, tytuł z sufiksem, walidacja nazwy, diff (1, 4, 5, 9).
- **Integracyjne** (Server Actions na MongoDB z Dockera):
  - kryteria 1–3, 5–9;
  - deduplikacja `chapterContents` przez hash stanu;
  - równoległe zapisy wersji;
  - przywrócenie usuniętego i przeniesionego rozdziału, pominięcie niezmienionego;
  - sprzątanie treści po usunięciu wersji.
- **E2E:**
  - zapis wersji z nazwą, zmiana rozdziałów, podgląd z porównaniem, przywrócenie jednego, a potem dwóch rozdziałów, wersja „Before restoring…” na liście (1, 4, 5);
  - usunięcie zaznaczonego rozdziału „added since” (5);
  - przywrócenie całej wersji z potwierdzeniem (9);
  - konflikt w otwartym edytorze po przywróceniu (6);
  - usunięcie wersji z potwierdzeniem (7).
