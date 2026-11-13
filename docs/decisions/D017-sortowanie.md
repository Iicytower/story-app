# D17 – Tryby sortowania (2026-10-20)

Status: aktualna. Zmieniona w D24 (miejsce zapisu), D55, D83 (created od najstarszego).

- Tryb folderów (`settings.folders.sort`, D24; pierwotnie `users.folderSort`): `updated` (domyślny, `lastActivityAt` malejąco) | `manual` | `alpha`. `folders.chapterSort`: `created` (domyślny, `createdAt` malejąco) | `manual` | `alpha`. Remis rozstrzyga `_id`. Specyfikacje sortowania w `lib/folders/sort.ts` (`folderOrder`, `chapterOrder`); kolejność rozdziałów w eksporcie, udostępnieniu i panelu Chapters (04, 05) bierze się z `chapterOrder` i `findChaptersInOrder`.
- `alpha`: kolacja `{ locale: "pl", strength: 2 }` – siła 2 ignoruje wielkość liter („a” = „A”, remis po `_id`), domyślna 3 tylko ustawia je obok siebie.
- `position` (folder, rozdział) jest ustawiane zawsze, także poza trybem manual: nowy element i rozdział przeniesiony „Move to…” dostaje `max + 1` w swojej grupie.
- Pierwsze przełączenie na manual zapisuje pozycje według kolejności widocznej w dotychczasowym trybie i ustawia flagę `settings.folders.manualOrder` (D24) / `folders.manualChapterOrder`. Kolejne przełączenia zachowują ręczną kolejność. Pozycje z migracji same by nie wystarczyły, bo `lastActivityAt` zmienia się po migracji.
- Move up / down przenumerowuje całą listę (0..n-1) zamiast zamieniać dwie wartości, bo pozycje mogą być równe (równoległe tworzenie) albo ich brak (dokumenty starego deploymentu). Na końcach listy akcja nic nie zmienia i zwraca `ok`. Przyciski są widoczne tylko w trybie manual.
- Zmiana trybu i kolejności nie zmienia `updatedAt` rozdziałów, `lastActivityAt` ani `notesUpdatedAt` folderu (pozycje zapisuje natywny `bulkWrite`, tryb rozdziałów `timestamps: false`). Nowy kod błędu `INVALID_INPUT` dla nieznanego trybu lub kierunku.
- Migracja `003-positions` (kopia `stories`, `folders`, `users`) jest powtarzalna jak `002`: uzupełnia brakujące `folderSort`/`chapterSort` (z flagą `false`) i dopisuje `position` dokumentom bez niej, za istniejącymi pozycjami grupy, w kolejności trybów domyślnych. Od D24 nie dotyka już `users` (brak trybu = domyślny). Dokumenty starego deploymentu z okna builda dostają pozycje przy kolejnym deployu; do tego czasu w trybie manual są na początku listy.
- Domyślny folder w „New story” na `/stories` to nadal folder z największym `lastActivityAt`, niezależnie od trybu listy.
