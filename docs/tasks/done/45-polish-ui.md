# 45 – Przełącznik języka i polski interfejs

Trzeci task wielojęzycznego interfejsu (D46).

## Zakres

- `pl` na liście języków i słownik `messages/pl` z pełnym tłumaczeniem (przygotowuje Claude, przegląda użytkownik).
- Ustawienie `appearance.locale` w `lib/settings/settings.ts` i modelu `Settings` (tylko wybrana wartość, bez domyślnej, jak inne ustawienia).
- Przełącznik „Language” w sidebarze (obok Toggle theme), tylko dla zalogowanych. Zmiana zapisuje ustawienie i cookie i przechodzi na ten sam adres w nowym języku.
- Po zalogowaniu ustawienie trafia do cookie, a przekierowanie idzie na język z ustawienia.
- Strony publiczne: `alternates.languages` (`hreflang`) w `metadata`.
- Aktualizacja `CLAUDE.md` („UI w całości po angielsku” → wielojęzyczny).

## Ustalenia

- Przełącznik tylko w sidebarze (decyzja użytkownika). Niezalogowany dostaje język z cookie albo `Accept-Language`.
- Nowy język w przyszłości: plik `messages/xx`, wpis na liście języków, nazwa w przełączniku. Bez zmian w kodzie stron.

## Kryteria akceptacji

1. Zalogowany zmienia język w sidebarze; adres i teksty zmieniają się bez utraty bieżącej strony.
2. Wybór zostaje po przeładowaniu, wylogowaniu i zalogowaniu na innym urządzeniu.
3. Wejście bez prefiksu prowadzi na język z ustawienia, potem cookie, potem `Accept-Language`.
4. Słownik `pl` ma wszystkie klucze `en` (pilnuje `tsc`), a polskie liczby mnogie mają poprawne formy (1, 2–4, 5+).
5. Komunikat błędu z Server Action jest po polsku na `/pl/...`.
6. Strony publiczne mają `hreflang` dla wszystkich języków.
7. Tłumaczenie przejrzane przez użytkownika.

## Testy

Unit: plurale `pl`, zgodność kluczy `pl` z `en`, `hreflang`. Integracyjne: zapis i walidacja `appearance.locale`. E2E: przełączenie na polski, utrzymanie po przeładowaniu, język po zalogowaniu, `Accept-Language` dla niezalogowanego, polski komunikat błędu. `manual`: przegląd tłumaczenia przez użytkownika.
