# 11 – Kolekcja ustawień

Ustalenia z użytkownikiem (2026-10-21): wszystkie ustawienia użytkownika, także tryb sortowania folderów i flaga ręcznej kolejności, w osobnej kolekcji z relacją do użytkownika; jeden dokument na użytkownika z grupami; stare pola przeniesione migracją i usunięte z `users`. Ustawień będzie przybywać, więc dodanie nowego ma być proste.

## Zakres

- Kolekcja `settings` (model `Settings`): `userId` (unikalny), grupy `editor`, `appearance`, `folders`. `users` bez `folderSort`, `manualFolderOrder`, `settings`.
- Rejestr ustawień (domyślna wartość, walidacja, zapis z klienta) jako jedyne źródło typu, wartości domyślnych i walidacji.
- `saveSettings` i klient (układ edytora, widok mobilny, motyw) na nowy kształt; `setFolderSort` i lista folderów czytają i zapisują `settings`.
- Migracja `004-settings`, poprawka `003-positions` (nie dotyka `users`).
- Decyzja D24, aktualizacja D17 i D23.

## Kryteria akceptacji

1. Ustawienia zapisują się w kolekcji `settings`, jeden dokument na użytkownika; `users` ich nie zawiera.
2. Zapis jednego pola nie zmienia pozostałych; równoległe pierwsze zapisy tworzą jeden dokument.
3. Klient nie może zapisać `folders.*` ani nieznanych pól przez `saveSettings`.
4. Migracja przenosi tryb sortowania i flagę (oraz ustawienia z niewydanych buildów taska 09) i usuwa je z `users`; kolejne uruchomienia nie nadpisują wyborów użytkownika domyślnymi.
5. Dotychczasowe zachowanie (układ, motyw, sortowanie folderów) bez zmian.

## Testy

- Jednostkowe: rejestr – domyślne, normalizacja pole po polu, odrzucanie patchy, ścieżki `$set` (2, 3).
- Integracyjne: `settings.test.ts` (1, 2, 3), `sorting.test.ts` (tryb w `settings`), `migration-004.test.ts` i `migration-003.test.ts` (4).
- E2E: istniejące `settings.spec.ts`, `layout.spec.ts`, `editor-panels.spec.ts`, `sorting`/`folders` na nowej kolekcji (5).
