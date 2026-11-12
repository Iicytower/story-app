# D40 – Rejestracja i limit prób (2026-11-01)

Status: aktualna.

- Zmienia D1 („brak rejestracji w UI”) i D4. Publiczna strona `/register`: nick, hasło, powtórzenie. Skrypt `create-account` zostaje.
- Rejestracja używa `createUser` (tylko `insert`), nigdy `createOrUpdateUser`, bo upsert zmieniłby hasło istniejącego konta. Zajęty nick i wyścig rozstrzyga unikalny indeks (D37), wcześniejszy odczyt daje ten sam komunikat bez liczenia hasha.
- Limit (mechanizm także dla taska 39): kolekcja `rateLimits`, dokument na regułę, klienta i okno: `_id` = `<reguła>:<HMAC-SHA256 z IP, klucz AUTH_SECRET>:<początek okna>`, `count`, `expiresAt`. Stałe okno, licznik resetuje się razem z oknem, a poprawność nie zależy od TTL, który tylko sprząta. IP w bazie nie jest zapisywane jawnie. Bez pliku migracji: indeks TTL tworzy `syncIndexes()` w buildzie (D14).
- `takeAttempt` najpierw zwiększa licznik, potem sprawdza, więc równoległe żądania nie przejdą limitu. `giveBackAttempt` oddaje próbę, która nie powinna się liczyć.
- Rejestracja: 5 kont na godzinę z IP. Liczą się tylko utworzone konta (decyzja użytkownika), więc literówki i zajęte nicki nie blokują, a sprawdzanie zajętości nicków nie ma limitu (odrzucany przed bcrypt, więc tani).
- Logowanie: 20 nieudanych prób na 15 minut z IP, sprawdzane w `authorizeCredentials`, bo `/api/auth/callback/credentials` da się wywołać z pominięciem akcji `login`. Po przekroczeniu nawet poprawne hasło daje „Too many attempts…” (`LoginRateLimited`). Udane logowanie oddaje próbę.
- IP: pierwszy adres z `x-forwarded-for`, który Vercel ustawia sam. Bez nagłówka wszyscy dzielą klucz `unknown`. IPv6 liczone po sieci /64, bo pojedynczy klient zwykle ma całą taką sieć. Współdzielony adres (NAT, akademik) dzieli limit.
- Gdy automatyczne logowanie po rejestracji trafi na limit logowania, konto już istnieje, więc akcja przekierowuje na `/login`.
- Vitest: `next-auth` w `server.deps.inline`, bo pakiet importuje `next/server` bez rozszerzenia, a `authorize.ts` i akcje używają jego klas błędów w testach.
