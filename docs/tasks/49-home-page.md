# 49 – Przebudowa strony głównej

Zgłoszenie użytkownika (2026-11-03). Strona główna (`/[locale]`) do przebudowy; kształt jeszcze nieustalony. Decyzje zapadają na starcie implementacji, razem z użytkownikiem, i trafiają do `docs/decisions.md`.

## Stan obecny

- Niezalogowany: publiczna wyszukiwarka opublikowanych opowiadań (task 39, D42) i przycisk „Log in / Create account” otwierający dialog logowania.
- Zalogowany: ta sama wyszukiwarka w układzie aplikacji z sidebarem (pozycje Home i Search prowadzą na tę samą stronę).

## Do ustalenia przed implementacją

- Co strona pokazuje niezalogowanemu, a co zalogowanemu (np. opis aplikacji, ostatnio opublikowane, ostatnio edytowane opowiadania, wyszukiwarka).
- Czy wyszukiwarka zostaje na stronie głównej, czy przechodzi pod osobny adres (i co wtedy z pozycjami Home i Search w sidebarze).
- Miejsce logowania i rejestracji.
- Układ, treści i teksty w obu językach.
- Wpływ na SEO stron publicznych (`metadata`, `hreflang`).

## Zakres

Uzupełniany po ustaleniach. Stałe wymagania: teksty w `messages/en.json` i `messages/pl.json`, działanie pod obydwoma prefiksami języka, wygląd zgodny z trybem jasnym i ciemnym (task 48).

## Kryteria akceptacji

Do uzupełnienia po ustaleniach, przed rozpoczęciem kodu.

## Testy

Do uzupełnienia razem z kryteriami. Istniejące testy E2E strony głównej i wyszukiwarki (`search`, `auth`, `layout`) poprawione do nowego układu.
