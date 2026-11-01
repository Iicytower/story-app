# 41 – Zmiana nicku i hasła

Zgłoszenie użytkownika (2026-11-01). Nick z migracji pochodzi z e-maila, a hasła sprzed nowych wymagań można wzmocnić tylko tutaj.

## Zakres

- Zmiana nicku po zalogowaniu.
- Zmiana hasła po zalogowaniu: stare hasło, nowe hasło, powtórzenie.
- Wejście z menu konta (D29).

## Ustalenia

- Nowe hasło spełnia wymagania z taska 36, a nick jego zasady. Zmiana nicku zmienia login i podpis autora.
- Bez odzyskiwania zapomnianego hasła. Reset zostaje tylko w `create-account`.

Do decyzji przy starcie taska:

- Dialog czy strona ustawień, bo aplikacja nie ma dziś takiej strony.
- Czy zmiana hasła unieważnia inne sesje. JWT nie ma do tego mechanizmu, więc propozycja: nie.
- Czy zmiana nicku wymaga hasła.
- Co ze starymi adresami `/p/<nick>/...` po zmianie nicku (D38): 404 czy przekierowanie.

## Kryteria akceptacji

1. Użytkownik zmienia nick i loguje się nowym; stary przestaje działać.
2. Zajęty lub niepoprawny nick daje komunikat.
3. Zmiana hasła wymaga poprawnego starego hasła, a nowe musi spełniać wymagania.
4. Po zmianie hasła działa tylko nowe.
5. Nick zmieniony na opublikowanym opowiadaniu widać w podpisie po wydaniu taska 38.
6. Akcje działają tylko na koncie z sesji, a `userId` nie pochodzi od klienta.

## Testy

Integracyjne: akcje, sesja, kolizje nicku, stare hasło, wymagania. E2E: zmiana nicku i hasła, ponowne logowanie. Kryterium 5: test podpisu na stronie `/p/...`.
