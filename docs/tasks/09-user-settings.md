# 09 – Ustawienia użytkownika

Preferencje trzymane dziś w `localStorage` przechodzą do ustawień użytkownika w bazie, więc działają na każdym urządzeniu i w każdej przeglądarce.

## Zakres

- Ustawienia zapisane przy koncie użytkownika (`users`, np. pole `settings`), odczyt w Server Components, zapis przez Server Action (sesja, `userId` tylko z sesji).
- Układ edytora (dziś `story-app:editor-layout`, D19): split, zakładka, kolejność kolumn, zwinięcia, szerokości, wysokości notatek.
  - Wczytany z serwera przy renderowaniu, bez mignięcia domyślnego układu po hydratacji.
  - Zapis z opóźnieniem (debounce) – przeciąganie paneli nie wysyła żądania na każdy piksel.
  - Walidacja na serwerze tak jak `parseLayout` (błędne pola → wartości domyślne).
- Motyw (dziś `story-app:theme`) – do ustalenia, patrz „Otwarte pytania”.
- Migracja nie jest potrzebna dla danych: brak ustawień = wartości domyślne. Ewentualne przeniesienie istniejącego układu z `localStorage` do bazy przy pierwszym wejściu – do ustalenia.
- Decyzja w `decisions.md` (zmienia część D19).

## Otwarte pytania

- Czy motyw też idzie do ustawień? Wymaga wtedy renderowania klasy `dark` na serwerze (zamiast skryptu z `localStorage`), żeby nie migało.
- Czy potrzebna jest strona ustawień (`/settings`), czy na razie tylko automatyczny zapis tego, co użytkownik zmienia w UI?
- Czy przenosić istniejący układ z `localStorage`, czy zacząć od domyślnego?
- Czy układ ma być wspólny dla desktopu i przeglądarki mobilnej?

## Kryteria akceptacji

1. Zmiana układu edytora jest zapisana w bazie i odtworzona po przeładowaniu oraz w innej przeglądarce (nowy kontekst bez `localStorage`).
2. Układ jest widoczny od pierwszego renderu, bez przeskoku z domyślnego.
3. Ustawienia jednego użytkownika nie wpływają na innego.
4. Błędne lub częściowe ustawienia w bazie nie psują edytora (wartości domyślne pole po polu).
5. Szybkie przeciąganie paneli wysyła ograniczoną liczbę zapisów.

## Testy

- Jednostkowe: walidacja i scalanie ustawień z domyślnymi (4).
- Integracyjne: Server Action zapisu – sesja, izolacja użytkowników, walidacja (3, 4).
- E2E: zmiana układu → przeładowanie i nowy kontekst przeglądarki (1, 2), drugi użytkownik ma domyślny układ (3), liczba żądań przy przeciąganiu (5).
