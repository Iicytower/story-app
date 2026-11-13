# D37 – Logowanie przez nick, bez migracji danych (2026-11-01)

Status: aktualna. Zmieniona w D80 (usuwanie konta, tombstone).

- Zmienia D1 i D4. Konto to `nickname` i hasło, komunikat błędu: „Invalid nickname or password.”. Bez fallbacku na e-mail w formularzu.
- `email` usunięty ze schematu `User`, ale zostaje w dokumentach (decyzja użytkownika): pliku migracji nie ma, a nicki istniejącym kontom właściciel ustawia ręcznie przed wydaniem (`deploy.md`). `syncIndexes()` w buildzie sam usuwa `email_1`, więc nowe konta nie kolidują na braku e-maila.
- Nick: jedno pole `nickname` z unikalnym indeksem z collation `{ locale: "en", strength: 2 }`, żeby ręczna zmiana w bazie dotyczyła jednego pola. Zapytania o nick muszą podawać tę collation. Indeks częściowy (`$type: "string"`), żeby konta jeszcze bez nicku nie wywracały builda kolizją na `null`.
- Nick: 3–30 znaków, `A-Za-z0-9_-`. Hasło: 17–256 znaków (punktów kodowych), mała i wielka litera (także Unicode), cyfra, znak specjalny ASCII. Walidacja w `lib/credentials.ts`, egzekwowana też w `createOrUpdateUser`. Istniejące hasła nie są sprawdzane.
- bcrypt uwzględnia tylko 72 bajty, więc nowe hasła idą przez SHA-256 (hex), a hash ma prefiks `sha256$`. Hash bez prefiksu to bcrypt surowego hasła sprzed D37 i działa dalej. Bez nowych pakietów.
- Zmienione w D80 (task 89): konto można usunąć w ustawieniach; nick zostaje zajęty przez tombstone w `users` (rejestracja i `create-account` go nie przejmują). Szczegóły w rozstrzygnięciach (89) w D80.
