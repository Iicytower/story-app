# 62 – Zapis dużej treści rozdziału kończy się 500

Z testów bezpieczeństwa 2026-11-07 ([F8](../security/pentest-2026-11-07.md#f8--zapis-dużej-treści-rozdziału-kończy-się-500-średnia)). PoC: `docs/security/exploits/large-content-save-dos.mjs`.

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
