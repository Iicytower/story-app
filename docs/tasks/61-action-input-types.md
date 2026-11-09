# 61 – Typy argumentów Server Actions

Z testów bezpieczeństwa 2026-11-07 ([F7](../security/pentest-2026-11-07.md#f7--typy-argumentów-server-actions-niska)).

## Zakres

- Każda Server Action sprawdza w runtime typy argumentów (string, liczba, boolean, data ISO) i przy złym typie zwraca `INVALID_INPUT` zamiast rzucać wyjątek. Dotyczy m.in. `createFolder`, `renameFolder`, `createStory`, `saveStory` (`title`, `content`, `notes`, `expectedUpdatedAt`), `saveFolderNotes`, `setChapterPublished`, `setFolderPublished`, `createFolderVersion`.
- Wspólny helper zamiast powtarzania `typeof` w każdej akcji (do decyzji).

## Kryteria akceptacji

1. Wywołanie akcji z argumentem złego typu (liczba, tablica, obiekt, `null`, niepoprawna data) zwraca `{ ok: false, error: "INVALID_INPUT" }` i nie zmienia danych.

## Testy

Integracyjne: dla każdej akcji zapisu wywołanie z argumentami złych typów.
