# D24 – Kolekcja `settings` (2026-10-21)

Status: aktualna. Zmienia D17 i D23.

- Zmienia D17 i D23. Ustawienia użytkownika w osobnej kolekcji `settings`, jeden dokument na użytkownika: `userId` (unikalny indeks, `ref: "User"`), grupy `editor` (`layout`, `mobileView`), `appearance` (`theme`), `folders` (`sort`, `manualOrder`), `createdAt`, `updatedAt`. `users` trzyma tylko dane konta.
- Rejestr pól w `lib/settings/settings.ts` (`SETTINGS`): wartość domyślna, walidacja i czy klient może je zapisać. Z niego wynikają typ `UserSettings`, `DEFAULT_SETTINGS`, `normalizeSettings` i `parseSettingsPatch`. Nowe ustawienie = wpis w rejestrze + pole w modelu `Settings`.
- W bazie są tylko wartości wybrane przez użytkownika (bez domyślnych w schemacie), więc zmiana domyślnej dociera do wszystkich. Brak dokumentu = same domyślne.
- Zapis: `updateUserSettings(userId, patch)` – `$set` po ścieżkach (`editor.layout`), upsert, `runValidators`; dwa równoległe pierwsze zapisy (E11000) ponawiane raz. `saveSettings` przyjmuje tylko pola `clientWritable` – `folders.*` zapisuje wyłącznie `setFolderSort`, bo pierwsze przełączenie na manual musi zapisać pozycje. Nieznane pole w patchu → `INVALID_INPUT`.
- Migracja `004-settings` (kopia `users`, `settings`), powtarzalna: przenosi `users.folderSort` / `manualFolderOrder` (oraz `users.settings` z niewydanych buildów taska 09) do `settings` i usuwa je z `users`. Wartość na `users` jest nowsza od tej w `settings` (stary deployment w oknie builda), więc nadpisuje. Rollback do starszej wersji = domyślne sortowanie folderów (ręczne pozycje zostają, ale pierwsze przełączenie na manual nadpisze je widoczną kolejnością).
- `003-positions` nie ustawia już trybu na `users` – inaczej przy każdym deployu dopisywałaby `updated`, a `004` przenosiłaby go do `settings` w miejsce wyboru użytkownika.
