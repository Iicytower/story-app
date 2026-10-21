# 10 – Rzadszy autozapis

Ustalenia z użytkownikiem (2026-10-21): autozapis 20 s po ostatnim naciśnięciu klawisza zamiast 3 s; dodatkowo zapis od razu przy ukryciu karty. Dotyczy edytora rozdziału i notatek folderu.

## Zakres

- `AUTOSAVE_DELAY_MS` = 20 000 w edytorze rozdziału (tytuł, treść, notatki rozdziału i folderu) i na stronie folderu (`folder-notes.tsx`). Debounce jak dziś: każda zmiana przesuwa zapis o 20 s, więc przy ciągłym pisaniu zapis czeka na przerwę.
- Zapis od razu, gdy karta zostaje ukryta (`visibilitychange` → `hidden`: przełączenie karty, zminimalizowanie, zamknięcie na mobile), przez tę samą kolejkę co autozapis. Pusty tytuł blokuje go tak jak autozapis.
- Bez zmian: Ctrl+S zapisuje od razu, ostrzeżenie `beforeunload` przy niezapisanych zmianach, zapis przed przejściem do innego rozdziału.
- Zmiana spec („około 3 s”) – decyzja w `decisions.md`.

## Kryteria akceptacji

1. Zmiana w treści, tytule, notatkach rozdziału lub notatkach folderu zapisuje się 20 s po ostatnim klawiszu, nie wcześniej.
2. Pisanie z przerwami krótszymi niż 20 s nie wywołuje zapisu.
3. Ukrycie karty z niezapisanymi zmianami zapisuje je od razu; bez zmian nie ma zapisu.
4. Ctrl+S, `beforeunload` i zapis przed zmianą rozdziału działają jak dotąd.

## Testy

- E2E z `page.clock`: brak zapisu po 19 s i zapis po 20 s (edytor i strona folderu); wpisywanie co 10 s przez 40 s bez zapisu; `visibilitychange` (emulowane `document.visibilityState = "hidden"`) zapisuje od razu, bez zmian nie wysyła żądania.
- Istniejące testy zapisu (`save.spec.ts`, `folders.spec.ts`, `editor-panels.spec.ts`) dostosowane do nowego opóźnienia (Ctrl+S albo `page.clock`) i zielone.
