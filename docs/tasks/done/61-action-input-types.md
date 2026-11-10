# 61 – Typy argumentów Server Actions

Z testów bezpieczeństwa 2026-11-07 ([F7](../../security/pentest-2026-11-07.md#f7--typy-argumentów-server-actions-niska)).

## Zakres

- Każda Server Action sprawdza w runtime typy argumentów (string, liczba, boolean, data ISO) i przy złym typie zwraca `INVALID_INPUT` zamiast rzucać wyjątek. Dotyczy m.in. `createFolder`, `renameFolder`, `createStory`, `saveStory` (`title`, `content`, `notes`, `expectedUpdatedAt`), `saveFolderNotes`, `setChapterPublished`, `setFolderPublished`, `createFolderVersion`.
- Wspólny helper zamiast powtarzania `typeof` w każdej akcji (do decyzji).

## Kryteria akceptacji

1. Wywołanie akcji z argumentem złego typu (liczba, tablica, obiekt, `null`, niepoprawna data) zwraca `{ ok: false, error: "INVALID_INPUT" }` i nie zmienia danych.

## Testy

Integracyjne: dla każdej akcji zapisu wywołanie z argumentami złych typów.

## Wynik (2026-11-09)

Decyzje: D71. Guardy z `lib/action-input.ts` w akcjach `stories/actions.ts`, `folders/actions.ts`, `folders/[id]/versions/actions.ts`, `folders/[id]/cover-actions.ts` (`setFolderCover` sprawdza `FormData`, `setCoverAdult` boolean), `stories/[id]/proofread-actions.ts` i `auth/login-actions.ts` (`FormData`). Akcje z argumentami `unknown` (ustawienia, słownik, narzędzia, rejestracja, zmiana hasła) już je sprawdzały.

Mapowanie kryteriów:
1. Zły typ argumentu → `INVALID_INPUT` (ID → `NOT_FOUND`, D71), dane bez zmian – `tests/integration/action-input-types.test.ts` (każda akcja zapisu z liczbą, tablicą, obiektem, `null`, obiektem z operatorem i niepoprawną datą; porównanie kolekcji przed i po), guardy – `lib/action-input.test.ts`.
