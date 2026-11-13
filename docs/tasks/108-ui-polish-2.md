# 108 – Poprawa UX i UI, runda 2 (zbiorczy)

Model: sonnet

Zgłoszenie użytkownika (2026-11-14), zakres z raportu [`docs/ui-ux-report.md`](../ui-ux-report.md) (punkty A1–A15 z audytu na żywo i B1–B18 z przeglądu kodu i wzorców), decyzja [D85](../decisions/D085-poprawa-ux-ui-2.md). Subtaski 109–125 realizowane w kolejności tabeli w `README.md`, w przebiegu bez nadzoru (`/autorun 108`). Szczegóły, kryteria i testy w plikach subtasków.

## Zakres

- Subtaski: 109 granice błędów, 404 i tytuły kart, 110 stany ładowania, 111 stany puste i Badge, 112 edytor na mobile, 113 czytelnik (szerokość, krój, mobile), 114 ustawienia czytania, 115 nawigacja w czytniku, strony publiczne i breadcrumb, 116 strona główna, sidebar i szerokości, 117 książka, forum, biblioteka, ustawienia, 118 tryb skupienia, 119 cele słów, 120 onboarding autora, 121 paleta poleceń i ściąga skrótów, 122 feedback akcji (Sonner, Button `loading`), 123 formularze (`Field`) i niezapisane zmiany, 124 powiadomienia, 125 audyt końcowy.
- Bez nowych pakietów npm; komponenty shadcn tylko na `radix-ui` (zasady jak w D83). Bez wysyłania e-maili (D85).
- `ui-checker` z Playwright MCP po każdym subtasku zmieniającym UI (D84: jeden wariant).

## Branche

- `fix/ui-2` z `develop`, lokalny, niepushowany.
- Subtaski: `feature/NN-<slug>` z aktualnego `fix/ui-2`; po zakończeniu jeden commit `NN: <krótki opis>`, status `[x]`, plik do `done/`, merge `--no-ff` do `fix/ui-2`.
- Gdy `develop` dostanie nowe commity, merge `develop` → `fix/ui-2` (agent `merger` przy konflikcie). Do `develop` merguje użytkownik po przeglądzie.

## Kryteria akceptacji

1. Kryteria wszystkich subtasków 109–125 spełnione albo task oznaczony „Blokada” z opisem.
2. `npm run verify` na `fix/ui-2` przechodzi po ostatnim subtasku.
3. `docs/ui-ux-report-after.md` z oceną i porównaniem z raportem (task 125).
4. `README.md` zaktualizowany, jeśli przebieg zmienił opisane w nim sekcje.
5. Wszystkie rozstrzygnięcia Claude'a z przebiegu dopisane w D85 („Rozstrzygnięcia Claude'a do potwierdzenia”).
6. Pozycje backlogu pokryte przez subtaski (strona 404 w układzie aplikacji, tytuły kart, pasek narzędzi notatek) usunięte z backlogu w `README.md`.

## Testy

Testy z plików subtasków. `manual`: kryterium 3 (przegląd raportu przez użytkownika), 4, 5 i 6 (przegląd przed merge'em).
