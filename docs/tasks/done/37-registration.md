# 37 – Rejestracja

Zgłoszenie użytkownika (2026-11-01). Publiczna strona `/register`. Zmienia D1 („brak rejestracji w UI”).

## Zakres

- Strona `/register`: nick, hasło, powtórzenie hasła. Nic więcej.
- Wymagania hasła widoczne przed wysłaniem, z informacją na żywo, które są spełnione.
- Server Action tworząca konto i logująca użytkownika.
- Link między `/login` i `/register`, `/register` w `isPublicPath`.
- Limit prób rejestracji.

## Ustalenia

- Hasło: wymagania i walidacja z taska 36.
- Bez resetu hasła w aplikacji. Zapomniane hasło oznacza utratę dostępu (decyzja użytkownika), a strona mówi o tym wprost przed założeniem konta. Zmiana po zalogowaniu: task 41.
- Bez maila nie ma weryfikacji konta, więc limit prób jest wymagany. Aplikacja działa na darmowych planach.

Do decyzji przy starcie taska:

- Mechanizm limitu na Vercelu. Ten sam użyje task 39.
- Czy limit obejmuje też logowanie.

## Kryteria akceptacji

1. Rejestracja wymaga tylko nicku i hasła, tworzy konto i loguje użytkownika.
2. Wymagania hasła są widoczne na stronie, a każde niespełnione jest wskazane osobno.
3. Każde wymaganie jest egzekwowane na serwerze, także przy bezpośrednim POST.
4. Zajęty nick daje komunikat, także przy innej wielkości liter i przy dwóch równoczesnych próbach.
5. Różne hasła w polach dają komunikat bez wysyłania na serwer.
6. Strona jasno informuje, że hasła nie można odzyskać.
7. Przekroczenie limitu daje komunikat i nie tworzy konta.
8. Hasło nigdy nie trafia do logów ani odpowiedzi, a w bazie jest tylko hash.
9. Nowe konto ma pustą listę opowiadań i domyślne ustawienia.

## Testy

Unit: lista wymagań na żywo. Integracyjne: akcja, duplikaty, wyścig, limit, `createdAt`. E2E: rejestracja i pierwsze wejście, słabe hasło, zajęty nick. `manual`: limit na Vercelu.
