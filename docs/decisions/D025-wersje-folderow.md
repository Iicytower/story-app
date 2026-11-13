# D25 – Wersje folderów (2026-10-21)

Status: aktualna. Zmieniona w D83 (adresy).

- Zmienia spec („Brak historii wersji”). Wersja to stan rozdziałów folderu zapisany ręcznie („Save version” na stronie folderu, wymagana nazwa po `trim()`, maks. 100 znaków). Automatycznie powstaje tylko „Before restoring version N” przed każdym przywróceniem – jak reflog w gicie, więc każde przywrócenie (także usunięcie rozdziałów) da się cofnąć.
- Notatki (rozdziałów i folderu) nie są częścią wersji: nie są zapisywane, porównywane ani przywracane.
- Kolekcja `folderVersions`: `userId`, `folderId`, `number`, `name`, `chapterSort`, `chapters` (`storyId`, `title`, `position` – indeks w kolejności widocznej przy zapisie, `contentId`), `createdAt`; unikalny `{ folderId, number }`. Numer z licznika `folders.versionCounter` (`$inc`), więc nie wraca po usunięciu wersji i nie powtarza się przy równoległych zapisach. Zapis wersji nie zmienia `updatedAt` folderu ani rozdziałów.
- Kolekcja `chapterContents`: jeden dokument na stan rozdziału (`title`, `content`), `_id` = SHA-256 z `[storyId, title, content]`, więc niezmieniony rozdział wskazuje istniejący dokument (upsert). Usunięcie wersji usuwa treści, na które nie wskazuje żadna inna wersja. Wyścig z równoległym zapisem wersji: zapis ustawia `usedAt` po wstawieniu wersji, a sprzątanie pomija treści z `usedAt` nowszym niż jego start.
- Wersja bierze rozdziały z bazy (niezapisane zmiany w otwartym edytorze nie wchodzą).
- Podgląd `/folders/[id]/versions/[n]`: statusy `changed` / `unchanged` / `deleted since` (usunięty albo przeniesiony) / `added since`. Porównanie słowo po słowie od wersji do bieżącego tekstu (`diffWordsWithSpace` z pakietu `diff`), osobno tytuł i treść; przy zbyt wielu zmianach (`maxEditLength` 5000, 500 ms) „Too many changes to compare.”.
- Dwa tryby przywracania, po sukcesie przekierowanie do widoku folderu:
  - „Restore entire version” (jak `git reset --hard`), z potwierdzeniem i podsumowaniem: zmienione rozdziały wracają, usunięte wracają, dodane od tamtej pory są usuwane (soft delete), wraca tryb sortowania, a przy trybie manual także kolejność z wersji.
  - „Restore selected” (jak `git restore --source`): zaznaczone rozdziały z wersji wracają, zaznaczone „added since” są usuwane. Niezmienionych nie da się zaznaczyć. Kolejność i tryb sortowania bez zmian.
- Przywrócony rozdział w folderze dostaje tytuł i treść z wersji z nowym `updatedAt` (otwarty edytor dostaje `CONFLICT`); niezmieniony nie jest zapisywany. Usunięty wraca jako ten sam dokument (`deletedAt: null`, na końcu kolejności ręcznej, bez starego linku udostępniania), więc dalsze porównania go rozpoznają. Przeniesiony do innego folderu jest kopiowany jako nowy rozdział (z bieżącymi notatkami oryginału). Zajęty tytuł → „Tytuł (2)”, „(3)”…; przy zamianie tytułów między dwoma przywracanymi rozdziałami jeden dostanie sufiks.
- Wersje cudzego i usuniętego folderu: `NOT_FOUND` / 404. Eksport i strony publiczne nie pokazują wersji.
