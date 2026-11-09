# 58 – Unieważnianie sesji

Z testów bezpieczeństwa 2026-11-07 ([F3, F4](../security/pentest-2026-11-07.md#f3--sesja-nie-jest-unieważniana-średnia)).

## Zakres

- Zmiana hasła unieważnia wszystkie inne sesje użytkownika (np. wersja sesji w `User`, zapisywana w JWT i sprawdzana w callbacku `jwt`/`session` albo w `requireUser`). Bieżąca sesja zostaje zalogowana.
- Wylogowanie unieważnia token, a nie tylko usuwa cookie – albo świadoma decyzja, że wystarcza krótszy `maxAge` (do ustalenia).
- Opcjonalnie: „Wyloguj wszystkie urządzenia” w ustawieniach (do decyzji).
- Limit prób w `changePassword` po użytkowniku (jak `PROOFREAD_LIMIT`).

Do decyzji przy starcie taska: mechanizm (wersja sesji vs lista unieważnionych tokenów), koszt odczytu `User` przy każdym żądaniu, `maxAge`, przycisk „wyloguj wszędzie”.

## Kryteria akceptacji

1. Po zmianie hasła inne sesje przestają działać (przekierowanie do logowania, akcje zwracają `UNAUTHORIZED`); sesja, z której zmieniono hasło, działa dalej.
2. Token skopiowany przed wylogowaniem nie daje dostępu po wylogowaniu (albo udokumentowana decyzja, czemu nie).
3. Zbyt wiele błędnych prób obecnego hasła w `changePassword` zwraca `RATE_LIMITED`.

## Testy

Integracyjne: wersja sesji po zmianie hasła, limit `changePassword`. E2E: dwa konteksty przeglądarki – zmiana hasła w jednym wylogowuje drugi.
