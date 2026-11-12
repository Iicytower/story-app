# D18 – Eksport i udostępnianie folderu (2026-10-20)

Status: aktualna. Część o udostępnianiu zastąpiona przez D38.

- `GET /folders/[id]/export`: zip budowany w pamięci przez `fflate` (`zipSync`). Rozdziały w kolejności `chapterSort` jako `NN-<nazwa>.md` (numer od 1, dopełniony zerami do liczby cyfr liczby rozdziałów, min. 2; nazwa jak w D10, fallback `chapter`), frontmatter jak w D10. Numer rozróżnia też rozdziały o tej samej nazwie pliku.
- `notes.md`: frontmatter `title` (nazwa folderu), `createdAt` (folderu), `updatedAt` (`notesUpdatedAt`), potem notatki folderu bez zmian. Archiwum: `<nazwa folderu>.zip` (fallback `folder.zip`). Komentarze HTML zostają w eksporcie, jak w D10.
- `folders.shareToken`: jak D11 (osobny unikalny indeks częściowy, ten sam token przy ponownym „Share”, `timestamps: false`, `lastActivityAt` bez zmian). `setFolderSharing` zwraca `sharePath: "/s/f/<token>" | null`. Udostępnianie folderu i rozdziałów jest niezależne.
- `/s/f/[token]`: nazwa folderu i numerowany spis. `/s/f/[token]/[n]`: rozdział `n` (od 1, w bieżącej kolejności folderu) z linkami poprzedni / „Contents” / następny; `n` spoza zakresu lub nieliczbowe → 404. Numery zmieniają się razem z kolejnością i usuwaniem rozdziałów. Obie strony: `connection()`, `metadata.robots`, `X-Robots-Tag` w `next.config.ts`, `stripComments`, bez notatek. `isPublicPath` obejmuje `/s/f/<token>` i `/s/f/<token>/<n>`.
- Przyciski w widoku folderu: „Export .zip” (link z `download`, bez zapisu – folder nie ma niezapisanych zmian poza autozapisywanymi notatkami) i „Share” / „Stop sharing” z polem linku i „Copy link”.
