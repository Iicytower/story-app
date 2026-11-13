# D85 – Poprawa UX i UI, runda 2 (2026-11-14)

Status: aktualna. Rozszerza D83 (nie zmienia jego ustaleń); korzysta z D84 (warianty `ui-checker`, model w linii `Model:`).

- Task zbiorczy 108, subtaski 109–125, decyzje użytkownika z 2026-11-14 na podstawie raportu `docs/ui-ux-report.md` (punkty A1–A15 z audytu na żywo, B1–B18 z przeglądu kodu i wzorców).

## Przebieg i branche

- Branch zbiorczy `fix/ui-2` z `develop`, lokalny, niepushowany. Subtaski: `feature/NN-<slug>` z aktualnego `fix/ui-2`, jeden commit `NN: <opis>`, merge `--no-ff` do `fix/ui-2`. Gdy `develop` dostanie nowe commity: merge `develop` → `fix/ui-2`. `fix/ui-2` do `develop` merguje użytkownik.
- Przebieg bez nadzoru: `/autorun 108`, w nocy przez `scripts/autorun-night.sh 108`. Zasady jak w D83/D84: bez nowych pakietów npm, nowe komponenty shadcn tylko na zainstalowanym `radix-ui` (źródło z MCP `shadcn`, zapis plikiem), `ui-checker` po każdym subtasku zmieniającym UI (jeden wariant), audyt końcowy (125) w ośmiu wariantach.

## Rozstrzygnięcia użytkownika

- Zakres: wszystkie propozycje raportu, z wyjątkami poniżej.
- Bez e-maili: nie dodajemy digestu e-mail ani innych wiadomości wysyłanych poza aplikację. Powiadomienia tylko w aplikacji (grupowanie i „oznacz wszystkie”, 124).
- Dialogi potwierdzenia usuwania zostają; nie dodajemy „Cofnij” zamiast nich.
- Cele słów: tylko opcjonalny cel rozdziału z paskiem postępu w stopce edytora (119); bez celów sesji i dziennych.
- Ustawienia czytania (rozmiar, szerokość, krój, interlinia) w `localStorage`, bez zmian schematu (114).
- Pokryte pozycje backlogu: 404 w układzie aplikacji i tytuły kart (109), pasek narzędzi notatek i półki domyślne (117). Po ukończeniu usunąć je z backlogu w `docs/tasks/README.md`.

## Rozstrzygnięcia Claude'a do potwierdzenia

(Uzupełniane w trakcie przebiegu.)
