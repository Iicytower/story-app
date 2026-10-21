# 09 – Ustawienia użytkownika

Preferencje trzymane dziś w `localStorage` przechodzą do ustawień użytkownika w bazie, więc działają na każdym urządzeniu i w każdej przeglądarce.

## Zakres

Decyzje użytkownika (2026-10-21): motyw też w ustawieniach; bez strony ustawień – zapisuje się automatycznie to, co użytkownik zmienia w UI; start od wartości domyślnych (bez przenoszenia z `localStorage`); osobny układ dla desktopu i widoku mobilnego.

- Ustawienia zapisane przy koncie użytkownika (`users`, pole `settings`), odczyt w Server Components, zapis przez Server Action (sesja, `userId` tylko z sesji). Brak ustawień = wartości domyślne, więc migracja danych nie jest potrzebna.
- Układ edytora na desktopie (dziś `story-app:editor-layout`, D19): split, zakładka, kolejność kolumn, zwinięcia, szerokości, wysokości notatek.
  - Wczytany z serwera przy renderowaniu, bez mignięcia domyślnego układu po hydratacji.
  - Zapis z opóźnieniem (debounce) – przeciąganie paneli nie wysyła żądania na każdy piksel.
  - Walidacja na serwerze tak jak `parseLayout` (błędne pola → wartości domyślne).
- Układ mobilny osobno: wybrany widok (Story / Notes / Chapters), dziś niezapamiętywany. Serwer wysyła oba układy, klient wybiera po `matchMedia` jak teraz.
- Motyw: klasa `dark` renderowana na serwerze z ustawień (koniec `themeScript` z `localStorage`), przełącznik zapisuje przez Server Action. Strona logowania ma motyw systemowy (`prefers-color-scheme`). Publiczne `/s/...` – do ustalenia.
- `localStorage` dla układu i motywu przestaje być używany; stare klucze są ignorowane.
- Decyzja w `decisions.md` (zmienia część D19 i zapis motywu).

## Kryteria akceptacji

1. Zmiana układu edytora (desktop i mobile osobno) oraz motywu jest zapisana w bazie i odtworzona po przeładowaniu oraz w innej przeglądarce (nowy kontekst bez `localStorage`).
2. Układ i motyw są widoczne od pierwszego renderu, bez przeskoku z domyślnych.
3. Ustawienia jednego użytkownika nie wpływają na innego.
4. Błędne lub częściowe ustawienia w bazie nie psują edytora (wartości domyślne pole po polu).
5. Szybkie przeciąganie paneli wysyła ograniczoną liczbę zapisów.

## Testy

- Jednostkowe: walidacja i scalanie ustawień z domyślnymi (4).
- Integracyjne: Server Action zapisu – sesja, izolacja użytkowników, walidacja (3, 4).
- E2E: zmiana układu desktop, widoku mobilnego i motywu → przeładowanie i nowy kontekst przeglądarki (1, 2), drugi użytkownik ma domyślny układ (3), liczba żądań przy przeciąganiu (5).
