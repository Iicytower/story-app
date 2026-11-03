# 44 – Słowniki tekstów interfejsu

Drugi task wielojęzycznego interfejsu (D46). Wszystkie teksty interfejsu przechodzą do słownika `en`; widocznych zmian brak.

## Zakres

- Słownik `messages/en` z kluczami pogrupowanymi według obszaru (sidebar, edytor, foldery, eksport, import, wersje, tagi, publikacja, wyszukiwarka, generator nazw, auth, błędy). Typy kluczy z `en`, więc brakujący klucz w innym języku to błąd `tsc`.
- Teksty z Server Components (`getTranslations`) i Client Components (provider i `useTranslations`), w tym `aria-label`, `placeholder`, `title` i teksty dialogów.
- Komunikaty `message` z Server Actions i `lib/` (walidacja, hasła, tagi, wersje, limity) tłumaczone na serwerze według języka żądania (D46).
- `metadata` stron (`generateMetadata` z tłumaczeniem).
- Liczby mnogie przez ICU (pod polskie formy w tasku 45).
- Daty w `components/local-date.tsx` według języka zamiast `en-US`.
- Etykiety stylów i filtrów generatora nazw. Dane generatora (człony, sylaby) to treść, nie UI, i zostają.

## Ustalenia

- Angielskie teksty zostają dosłownie takie jak dziś, żeby selektory E2E (`getByRole`, `getByText`) działały bez zmian.
- Po tym tasku każdy nowy tekst interfejsu trafia do słowników: zaktualizować regułę w `CLAUDE.md` i definicję „zrobione” w `docs/tasks/README.md`.

## Kryteria akceptacji

1. W komponentach i akcjach nie ma tekstów interfejsu poza słownikiem (poza danymi generatora nazw i treścią użytkownika).
2. Interfejs po angielsku wygląda tak jak przed taskiem.
3. Komunikaty błędów z Server Actions pochodzą ze słownika i mają ten sam kształt `{ ok, error, message }`.
4. Daty są formatowane według języka z adresu.
5. Liczby mnogie używają ICU.

## Testy

Unit: formatowanie dat według języka, plurale ICU. Integracyjne: komunikaty akcji ze słownika (istniejące testy komunikatów przechodzą). E2E: istniejący zestaw bez zmian w selektorach tekstowych. `manual`: przegląd, że w kodzie nie zostały teksty spoza słownika (grep po literałach w JSX i `message:`).
