# D39 – Zmiana hasła, bez zmiany nicku (2026-11-01)

Status: aktualna.

- Zmienia zakres taska 41 (decyzja użytkownika): nicku nie można zmienić, także z migracji. Adresy `/p/<nick>/...` są więc stałe i nie ma `formerNicknames`. Nick poprawia tylko właściciel ręcznie w bazie (D37).
- „Change password” w menu konta (D29) otwiera dialog, bez strony ustawień. Dialog jest renderowany obok `DropdownMenu`, bo menu odmontowuje treść po zamknięciu.
- Akcja `changePassword` przyjmuje stare hasło, nowe i powtórzenie. Konto bierze z sesji. Błędny typ, różne hasła, słabe nowe i złe stare dają `INVALID_INPUT`. Nowe może być równe staremu, o ile spełnia wymagania.
- Wymagania są wypisane przy polu nowego hasła (`PASSWORD_REQUIREMENTS` w `lib/credentials.ts`, `aria-describedby`), a test pilnuje zgodności listy znaków specjalnych z `passwordError`.
- Zmiana hasła nie unieważnia sesji (JWT nie ma do tego mechanizmu), więc inne urządzenia zostają zalogowane do wygaśnięcia sesji. Bez opóźnienia `LOGIN_DELAY_MS`: zgadywać starego hasła może tylko ktoś z ważną sesją.
