# 62 – Zapis dużej treści rozdziału kończy się 500

Z testów bezpieczeństwa 2026-11-07 ([F8](../../security/pentest-2026-11-07.md#f8--zapis-dużej-treści-rozdziału-kończy-się-500-średnia)). PoC: `docs/security/exploits/large-content-save-dos.mjs`.

## Problem

`saveStory` z treścią rozdziału od ok. 1 MB zwraca HTTP 500 („Maximum array nesting exceeded” z dekodera React Flight) zamiast zapisać albo zwrócić czysty wynik. Potwierdzone koderem klienta `encodeReply`, więc dotyczy zwykłego zapisu z edytora (także autozapisu). Granica jest znacznie poniżej `MAX_IMPORT_TEXT_BYTES` (3,5 MB) i `serverActions.bodySizeLimit` (4 MB). Prawdopodobnie te same granice dotyczą `notes` w `saveStory` i `saveFolderNotes`.

## Zakres

- Ustalić próg i przyczynę w bieżącej wersji React/Next (blokada zagnieżdżenia w dekoderze Flight); sprawdzić, czy aktualizacja z taska 56 go zmienia. API sprawdzić w dokumentacji (context7), nie z pamięci.
- Niezależnie od wersji: twardy limit długości treści i notatek, egzekwowany w akcji (`INVALID_INPUT` z komunikatem w obu językach) i w UI (licznik/komunikat), ustawiony bezpiecznie poniżej progu Flight. Spójny z limitem importu (task 59).
- Autozapis przy przekroczeniu nie może „połykać” pracy po cichu: użytkownik dostaje czytelny komunikat, treść zostaje w edytorze.

Do decyzji przy starcie taska (nowa decyzja w `decisions.md`): maksymalna długość treści rozdziału i notatek; czy limit współdzielić z taskiem 59.

## Kryteria akceptacji

1. Zapis rozdziału z treścią powyżej limitu zwraca `INVALID_INPUT` (nie 500) i nie gubi tekstu z edytora.
2. Zapis tuż poniżej limitu działa i zapisuje całą treść.
3. To samo dla notatek rozdziału i notatek folderu.
4. Import pozostaje spójny z limitem (task 59 / `MAX_IMPORT_TEXT_BYTES`).

## Testy

Integracyjne: `saveStory`/`saveFolderNotes` z treścią tuż poniżej i tuż powyżej limitu (wynik, brak 500). E2E: wklejenie zbyt długiej treści w edytorze pokazuje komunikat, a nie błąd aplikacji. Regresja: `docs/security/exploits/large-content-save-dos.mjs` nie daje już 500.

## Wynik (2026-11-10)

Decyzje: D72 (limity, wspólne z taskiem 59), D73 (przyczyna i próg). Próg po aktualizacji z taska 56 bez zmian: 1 000 000 jednostek UTF-16 sumy napisów w tablicy argumentów (bajty bez znaczenia).

Regresja PoC (`docs/security/exploits/large-content-save-dos.mjs`, build produkcyjny na bazie `story_app_pentest`, 2026-11-10): 500 KB → `CONFLICT` (nieaktualny `updatedAt` w PoC), 900 KB → `INVALID_INPUT`, od 1000 KB → nadal 500 z dekodera Reacta, zanim akcja ruszy (D73). Przeglądarka aplikacji tego nie wysyła, więc kryterium 1 dotyczy zapisu z edytora i każdego żądania, które dociera do akcji.

Mapowanie kryteriów:
1. Zapis powyżej limitu → `INVALID_INPUT`, tekst zostaje w edytorze – `tests/integration/large-content-save.test.ts` („rejects content just above the limit”), E2E `tests/e2e/large-content.spec.ts` („a pasted text over the limit gives a message and stays in the editor”: komunikat od razu i po Ctrl+S, baza bez zmian, edytor ma całe 500 001 znaków). `manual`: PoC wyżej (powyżej ~1 000 000 dalej 500 z frameworka).
2. Zapis tuż poniżej limitu zapisuje całą treść – `large-content-save.test.ts` („saves content and notes just below the limit, whole”, polskie znaki po 2 bajty), E2E „saves a chapter of exactly 500,000 characters” (prawdziwe kodowanie Flight w przeglądarce).
3. Notatki rozdziału i folderu – `large-content-save.test.ts` („rejects notes…”, „folder notes just below and just above the limit”).
4. Import spójny z limitem – `large-content-save.test.ts` („import takes a chapter as long as the editor can save”), `tests/integration/data-limits.test.ts` (za długi rozdział w imporcie), E2E `import.spec.ts`.
