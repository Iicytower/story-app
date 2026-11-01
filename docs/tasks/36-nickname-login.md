# 36 – Logowanie przez nick

Zgłoszenie użytkownika (2026-11-01). Rezygnacja z e-maila: konto to nick (login) i hasło. Zmienia D1. Rejestracja w UI: task 37.

## Zakres

- Pole `nickname` w `users`, wymagane i unikalne bez względu na wielkość liter.
- Logowanie nickiem: formularz, `authorizeCredentials`, Auth.js, `/login`.
- Wspólna walidacja hasła dla `create-account`, rejestracji (37) i zmiany hasła (41).
- `npm run create-account` pyta o nick i egzekwuje wymagania hasła. Ścieżka zmiany hasła istniejącego konta zostaje (reset przez właściciela).
- Migracja istniejących kont.
- Usunięcie e-maila z kodu, modelu i testów.

## Ustalenia

- Nick: 3–30 znaków, litery, cyfry, `_` i `-` (decyzja użytkownika).
- Nick jest też publicznym podpisem autora w taskach 38 i 39 (decyzja użytkownika). Nick z migracji można zmienić w tasku 41.
- Wielkość liter: wyświetlany jak wpisany, a unikalność i logowanie po wersji znormalizowanej.
- Hasło: co najmniej 17 znaków, mała i wielka litera, cyfra, znak specjalny (decyzja użytkownika).
- Istniejące hasła zostają, także te niespełniające nowych wymagań.
- Migracje są expand-only (`docs/deploy.md`), bo stary deployment obsługuje ruch w trakcie builda. Dlatego pierwsza migracja dodaje `nickname` i zachowuje `email`, a usunięcie pola idzie osobną migracją w kolejnym wydaniu. Indeks unikalny na `email` musi zniknąć razem z nowym kodem, bo konta bez e-maila by z nim kolidowały.
- Nick z migracji: część e-maila przed `@`, niedozwolone znaki zamienione na `_`, za krótki uzupełniony, a przy kolizji sufiks.

Do decyzji przy starcie taska:

- Czy formularz przez jedno wydanie przyjmuje też stary e-mail. Dziś jest jedno konto (właściciela), więc propozycja: nie.
- Definicja znaku specjalnego. Propozycja: znak inny niż litera i cyfra, także Unicode.
- Górna długość hasła: bcrypt uwzględnia tylko 72 bajty, więc dłuższe hasło trzeba odrzucić albo jasno obsłużyć.

## Kryteria akceptacji

1. Logowanie nickiem i hasłem działa, bez rozróżniania wielkości liter nicku.
2. Formularz nie zawiera e-maila, a błędne dane dają ten sam komunikat dla złego nicku i hasła.
3. Po migracji każde konto ma poprawny, unikalny nick i to samo hasło; opowiadania i ustawienia zostają bez zmian.
4. Migracja jest powtarzalna i rozwiązuje kolizje.
5. Stary deployment może logować przez e-mail do końca okna builda.
6. Po drugiej migracji w bazie nie ma pola `email` ani jego indeksu.
7. `create-account` tworzy konto z nickiem i odrzuca słabe hasło.
8. Testy nie zostawiają odwołań do e-maila w helperach E2E.

## Testy

Unit: walidacja i normalizacja nicku, wyprowadzenie z e-maila, każde wymaganie hasła osobno. Integracyjne: `authorize`, konta, obie migracje, kolizje, indeksy. E2E: logowanie nickiem, błędne dane (uzupełnić `auth.spec.ts` i helpery). `manual`: migracja na stagingu.
