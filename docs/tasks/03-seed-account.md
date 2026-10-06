# 03 – Skrypt seedujący konto

Spec: „Logowanie”, „Zmienne środowiskowe”; decisions.md D1.

## Zakres

- Skrypt (np. `npm run create-account`) uruchamiany lokalnie, czyta `MONGODB_URI` z `.env.local`.
- Interaktywnie pyta o e-mail i hasło (2x, potwierdzenie); hasło niewidoczne przy wpisywaniu.
- Hash `bcryptjs`, zapis do kolekcji `users` (e-mail lowercase).
- Istniejący e-mail → pytanie, czy zmienić hasło.

## Kryteria akceptacji

- Niezgodne hasła → ponowne pytanie lub czytelny błąd.
- Kolejne uruchomienie dodaje kolejne konto, które od razu może się zalogować.
