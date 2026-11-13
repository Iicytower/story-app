# 98 – Strona książki, opis i wersje

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/98-book-page` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Lista rozdziałów: tylko tagi różne od tagów książki (3.4). Status publikacji jako etykieta tekstowa „Publiczny” / „Niepubliczny” (z ikoną lub bez) na liście książek i rozdziałów (3.5).
- Link publiczny: kompaktowy wiersz „Publiczny · Kopiuj link · Otwórz” bez pola z URL, w książce i w edytorze (3.6).
- Szkielety o stałej wysokości dla elementów doładowywanych po hydratacji (wiersz linku, pasek notatek) (3.9).
- Nowe pole `folders.description` (string, domyślnie `""`, do 1000 znaków – `lib/limits.ts`, walidacja w akcji i w przeglądarce, D72): edycja na stronie książki (textarea, zapis akcją), eksport/import danych jeśli obejmuje pola folderu, wersje książki jeśli kopiują pola folderu, `npm run seed` z opisami. Wyświetlanie na stronie publicznej w 105, w wynikach wyszukiwarki w tym tasku (jedna linia, ucięta).
- Wersje (3.8): „Przywróć całą wersję” nieaktywny, gdy żaden rozdział się nie różni; styl drugorzędny; `AlertDialog` z potwierdzeniem; klikalny cały wiersz checkboxa.

## Kryteria akceptacji

1. Rozdział nie powtarza tagów książki; status publikacji czytelny bez najechania.
2. Wiersz linku publicznego mieści się w jednej linii; kopiowanie i otwarcie działają.
3. Opis książki zapisuje się, respektuje limit, jest izolowany per użytkownik i widoczny w wynikach wyszukiwarki tylko dla opublikowanej książki.
4. Przywrócenie wersji: przycisk nieaktywny bez różnic; z różnicami wymaga potwierdzenia.

## Testy

- Unit: `lib/limits.test.ts` (limit opisu).
- Integracyjne: `tests/integration/folders-actions.test.ts` (3 – zapis, limit, cudzy folder `NOT_FOUND`), `public-search.test.ts` (3), `folder-versions.test.ts` jeśli wersje obejmują opis.
- E2E: `folders.spec.ts` (1, 2, 3), `versions.spec.ts` (4), `publish.spec.ts` (2).
