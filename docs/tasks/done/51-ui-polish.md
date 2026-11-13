# 51 – Poprawa UX i UI (zbiorczy)

Zgłoszenie użytkownika (2026-11-04), zakres z raportu [`docs/ui-ux-report.md`](../../ui-ux-report.md) (2026-11-12, ocena 6/10), decyzja [D83](../../decisions/D083-poprawa-ux-ui.md). Subtaski 93–107 realizowane w kolejności tabeli w `README.md`, w przebiegu bez nadzoru (`/autorun 51`). Szczegóły, kryteria i testy w plikach subtasków.

## Zakres

- Subtaski: 93 nazewnictwo i adresy, 94 daty w lokalnej strefie, 95 sidebar i blok konta, 96 szerokości i sidebar na `/p`, 97 główne akcje i kolejność rozdziałów, 98 strona książki i wersje, 99 edytor, 100 strona główna, 101 ustawienia z zakładkami, 102 profil, biblioteka, statystyki, 103 reakcje i fora, 104 wiadomości i aktualności, 105 publiczna książka i rozdział, 106 moderacja i admin, 107 audyt końcowy.
- Wszystkie trzy poziomy raportu (sekcja 11). Bez nowych pakietów npm; komponenty shadcn tylko na `radix-ui` (D83).
- `ui-checker` z Playwright MCP po każdym subtasku zmieniającym UI (D83).

## Branche

- `fix/ui` z `feature/social`, lokalny, niepushowany.
- Subtaski: `feature/NN-<slug>` z aktualnego `fix/ui`; po zakończeniu jeden commit `NN: <krótki opis>`, status `[x]`, plik do `done/`, merge do `fix/ui`.
- Gdy `feature/social` dostanie nowe commity, merge `feature/social` → `fix/ui` (agent `merger` przy konflikcie). Do `feature/social`/`develop` merguje użytkownik po przeglądzie.

## Kryteria akceptacji

1. Kryteria wszystkich subtasków 93–107 spełnione albo task oznaczony „Blokada” z opisem.
2. `npm run verify` na `fix/ui` przechodzi po ostatnim subtasku.
3. `docs/ui-ux-report-after.md` z nową oceną i porównaniem z raportem (task 107).
4. `README.md` zaktualizowany, jeśli przebieg zmienił opisane w nim sekcje.
5. Wszystkie rozstrzygnięcia Claude'a z przebiegu dopisane w D83 („Rozstrzygnięcia Claude'a do potwierdzenia”).

## Testy

Testy z plików subtasków. `manual`: kryterium 3 (przegląd raportu przez użytkownika), 4 i 5 (przegląd przed merge'em).
