# 04 – Logowanie i ochrona tras

Spec: „Logowanie”, „Architektura i ścieżki”.

## Zakres

- Auth.js, provider Credentials, sesja JWT: `maxAge` 30 dni, odnawiana przy każdym wejściu.
- `authorize`: wyszukanie usera po e-mailu (lowercase) w `users`, weryfikacja `bcryptjs`, każda odpowiedź opóźniona o 1,5 s (także sukces).
- Route Handler `/api/auth/[...nextauth]`.
- Middleware/proxy: wszystko poza `/login`, `/api/auth/*` i `/s/[token]` wymaga sesji.
- Strona `/login` (formularz e-mail + hasło, komunikat błędu po angielsku).
- `/` przekierowuje do `/stories`.
- `id` użytkownika w tokenie JWT i w `session.user` (rozszerzenie typów Auth.js).
- Helper `requireUser()` zwracający `userId` z sesji, do użycia w Server Actions, Route Handlerach i Server Components (brak sesji → `UNAUTHORIZED`).
- Sprawdzić w dokumentacji wymagane zmienne Auth.js dla użytej wersji.

## Kryteria akceptacji

- Niezalogowany użytkownik → przekierowanie na `/login`.
- Błędne dane → komunikat, opóźnienie ~1,5 s.
- `/s/[token]` dostępne bez sesji.

## Testy

- Integracyjne: `authorize` – poprawne dane → user z `id`; złe hasło / nieznany e-mail → `null`; e-mail wielkimi literami działa; opóźnienie ≥ 1,5 s (mock timera lub pomiar).
- Jednostkowy: `requireUser()` bez sesji → `UNAUTHORIZED`.
- E2E: pisane w tasku 05 (`auth.spec.ts`), bo infrastruktura Playwrighta powstaje tam. Dostępność `/s/[token]` bez sesji – w tasku 12.
