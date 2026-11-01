# 36 – Logowanie przez nick

Zgłoszenie użytkownika (2026-11-01). Rezygnacja z e-maila przy logowaniu: konto to nick (login) i hasło. Bez migracji danych, pole `email` zostaje w bazie (decyzja użytkownika, D37). Zmienia D1. Rejestracja w UI: task 37.

## Zakres

- Pole `nickname` w `users`, wymagane i unikalne bez względu na wielkość liter.
- Logowanie nickiem: formularz, `authorizeCredentials`, Auth.js, `/login`.
- Wspólna walidacja hasła dla `create-account`, rejestracji (37) i zmiany hasła (41).
- `npm run create-account` pyta o nick i egzekwuje wymagania hasła. Ścieżka zmiany hasła istniejącego konta zostaje (reset przez właściciela).
- Usunięcie e-maila z kodu, modelu i testów (dane w bazie zostają).

## Ustalenia

- Nick: 3–30 znaków, litery, cyfry, `_` i `-` (decyzja użytkownika).
- Nick jest też publicznym podpisem autora w taskach 38 i 39 (decyzja użytkownika). Nick z migracji można zmienić w tasku 41.
- Wielkość liter: wyświetlany jak wpisany, a unikalność i logowanie bez rozróżniania wielkości liter.
- Nick z liter a-z, bez Unicode (decyzja użytkownika).
- Hasło: 17–256 znaków, mała i wielka litera, cyfra, znak specjalny ASCII (decyzja użytkownika).
- Istniejące hasła zostają, także te niespełniające nowych wymagań.
- Istniejące konta dostają nick ręcznie (użytkownik). Pliku migracji nie ma: `syncIndexes()` w buildzie usuwa `email_1` i buduje `nickname_1`.

## Kryteria akceptacji

1. Logowanie nickiem i hasłem działa, bez rozróżniania wielkości liter nicku.
2. Formularz nie zawiera e-maila, a błędne dane dają ten sam komunikat dla złego nicku i hasła.
3. Istniejące hasła działają dalej, a hasła różniące się dopiero po 72. bajcie są rozróżniane.
4. Build usuwa indeks `email_1`, zachowuje pole `email` i nie pada na kontach bez nicku.
5. Stary deployment może logować przez e-mail do końca okna builda.
6. Nick wpisany ręcznie w bazie działa i jest unikalny.
7. `create-account` tworzy konto z nickiem i odrzuca słabe hasło.
8. Testy nie zostawiają odwołań do e-maila w helperach E2E.

## Testy

Unit: walidacja nicku, każde wymaganie hasła osobno. Integracyjne: `authorize`, konta, indeksy. E2E: logowanie nickiem, błędne dane (`auth.spec.ts` i helpery). `manual`: nick ustawiony na stagingu i logowanie.
