# 58 – Unieważnianie sesji

Z testów bezpieczeństwa 2026-11-07 ([F3, F4](../../security/pentest-2026-11-07.md#f3--sesja-nie-jest-unieważniana-średnia)).

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

## Wynik (2026-11-10)

Decyzje: D75 (także I5 z raportu). Kolekcja `sessions` (`lib/models/session.ts`), logika w `lib/auth/sessions.ts` i `lib/auth/callbacks.ts`, akcja `logOutOtherDevices` i limit w `changePassword` (`app/[locale]/(protected)/actions.ts`), przycisk w `components/settings-dialog.tsx`, reguły haseł w `lib/credentials.ts`.

Mapowanie kryteriów:
1. Po zmianie hasła inne sesje przestają działać, bieżąca działa – `tests/integration/sessions.test.ts` („changePassword ends the other sessions”), E2E `tests/e2e/sessions.spec.ts` („changing the password in one browser signs out the other”, dwa konteksty przeglądarki), także „Log out other devices keeps this one signed in”.
2. Token skopiowany przed wylogowaniem nie działa – `sessions.test.ts` („a token copied before signing out does not work after it”), E2E „a cookie copied before logging out does not work after it”.
3. Za dużo błędnych prób obecnego hasła → `RATE_LIMITED` – `sessions.test.ts` („changePassword limit”).

I5: `lib/credentials.test.ts` („passwordError for weak passwords”). Hasła testowe i kont E2E zmienione tak, żeby spełniały nowe reguły.

`manual` (użytkownik, po wdrożeniu na staging): wszyscy są raz wylogowani (stare tokeny bez `sid`); zalogować się w dwóch przeglądarkach, zmienić hasło w jednej i sprawdzić, że druga po odświeżeniu nie ma dostępu.
