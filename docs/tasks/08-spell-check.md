# 08 – Sprawdzanie pisowni

Ustalenia z użytkownikiem (2026-10-21): opowiadania tylko po polsku, tekst nie może opuszczać przeglądarki, sprawdzanie na bieżąco, bez kosztów. Gramatyki i interpunkcji po polsku nie da się sprawdzać lokalnie i za darmo (LanguageTool to serwer w Javie, narzędzia działające w przeglądarce obsługują tylko angielski), więc task obejmuje tylko pisownię; gramatyka i interpunkcja trafiają do backlogu (D21).

## Zakres

- Wbudowany spellcheck przeglądarki, bez nowych pakietów i bez wysyłania tekstu na zewnątrz.
- `lang="pl"` i `spellcheck="true"` na polach z tekstem opowiadania: tytuł, treść (Preview – pole Tiptap, Source – textarea), notatki rozdziału i folderu (także na stronie folderu), tytuły w dialogach nowego rozdziału / opowiadania.
- Reszta UI zostaje `lang="en"` (`<html lang="en">` bez zmian).
- Podkreślenia i podpowiedzi z menu kontekstowego przeglądarki; brak własnego słownika i „Ignore” w aplikacji (słownik użytkownika jest w przeglądarce).
- Komentarze (`<!-- -->`) dziedziczą `lang="pl"` z pola – też sprawdzane.
- Decyzja w `decisions.md` (D21).

## Kryteria akceptacji

1. Pola tekstu opowiadania (lista z Zakresu) mają `lang="pl"` i `spellcheck="true"` w obu trybach edytora.
2. Elementy UI poza tymi polami nie dostają `lang="pl"`.
3. W Chrome i Firefoksie z zainstalowanym polskim słownikiem błędne słowo w treści jest podkreślone, a menu kontekstowe proponuje poprawkę.

## Testy

- E2E: atrybuty `lang` i `spellcheck` na tytule, treści w Preview i Source, notatkach rozdziału i folderu, polach tytułu w dialogach (kryterium 1); przycisk paska narzędzi i pole „Share link” bez `lang="pl"` (kryterium 2).
- `manual`: kryterium 3 (podkreślenia rysuje przeglądarka, Playwright ich nie widzi).

## Weryfikacja manual

- 2026-10-21, Chrome: kryterium 3 potwierdzone przez użytkownika. Warunek: polski włączony w `chrome://settings/languages` → Sprawdzanie pisowni; bez tego Chrome sprawdza polski tekst słownikiem angielskim (`lang` nie wybiera słownika).
