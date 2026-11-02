# 41 – Zmiana hasła

Zgłoszenie użytkownika (2026-11-01). Hasła sprzed nowych wymagań można wzmocnić tylko tutaj. Pierwotnie task obejmował też zmianę nicku; użytkownik z niej zrezygnował przy starcie (D39).

## Zakres

- Zmiana hasła po zalogowaniu: stare hasło, nowe hasło, powtórzenie.
- Dialog otwierany z menu konta (D29).
- Przy polu nowego hasła dokładna lista wymagań.

## Ustalenia

- Nowe hasło spełnia wymagania z taska 36.
- Bez odzyskiwania zapomnianego hasła. Reset zostaje tylko w `create-account`.
- Zmiana hasła nie unieważnia innych sesji (decyzja użytkownika).
- Nicku nie można zmienić (decyzja użytkownika, D39).

## Kryteria akceptacji

1. Zmiana hasła wymaga poprawnego starego hasła, a nowe musi spełniać wymagania.
2. Po zmianie hasła działa tylko nowe.
3. Akcja działa tylko na koncie z sesji, a `userId` nie pochodzi od klienta.
4. Przy polu nowego hasła widać dokładne wymagania, zgodne z walidacją.

## Testy

Unit: lista wymagań zgodna z `passwordError`. Integracyjne: akcja, sesja, stare hasło, wymagania, powtórzenie. E2E: dialog, komunikaty błędów, ponowne logowanie.
