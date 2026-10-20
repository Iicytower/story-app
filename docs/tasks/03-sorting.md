# 03 – Tryby sortowania folderów i rozdziałów

Zależy od 02.

## Zakres

- Lista folderów: tryby `updated` (domyślnie, `lastActivityAt` malejąco), `manual`, `alpha` (A–Z). Wybór zapisywany w `users.folderSort`.
- Rozdziały w folderze: tryby `created` (domyślnie, najnowsze pierwsze), `manual`, `alpha`. Wybór zapisywany per folder w `folders.chapterSort`.
- Tryb `manual`: pole `position` (folder, rozdział) i przyciski „Move up” / „Move down”, widoczne tylko w trybie manual. Przełączenie na manual po raz pierwszy zaczyna od bieżącej kolejności. Nowy element trafia na koniec.
- `alpha`: porównanie bez rozróżniania wielkości liter i z polskimi znakami (`collation: { locale: "pl" }`).
- Migracja `003-positions`: `position` dla istniejących folderów i rozdziałów (wg trybów domyślnych), `folderSort`/`chapterSort` domyślne. Kopia: `stories`, `folders`, `users`.
- Zmiana kolejności i trybu nie zmienia `updatedAt` rozdziału ani `lastActivityAt` folderu.
- Tryb rozdziałów folderu określa kolejność wszędzie: widok folderu, panel Chapters (05), eksport `.zip` i udostępniony folder (04).

## Kryteria akceptacji

1. Każdy z trzech trybów sortuje poprawnie (folderów i rozdziałów). Domyślnie `updated` i `created` (najnowsze pierwsze).
2. Wybrany tryb przetrwa przeładowanie i jest wspólny dla wszystkich urządzeń.
3. Move up / down w trybie manual. Pierwszy element nie idzie wyżej, ostatni nie idzie niżej.
4. Pierwsze przełączenie na manual zachowuje widoczną kolejność.
5. Zmiana kolejności lub trybu nie zmienia `updatedAt` rozdziału (otwarty edytor nie dostaje `CONFLICT`).
6. Sortowanie `alpha` traktuje „a” i „A” jednakowo, a „ł” stawia po „l”.
7. Izolacja: zmiana kolejności lub trybu w cudzym folderze → `NOT_FOUND`.

## Testy

- Integracyjne: zapytania i akcje (1–7), migracja `003`.
- E2E: przełączenie trybu i Move up na liście folderów i w folderze (1–3).
