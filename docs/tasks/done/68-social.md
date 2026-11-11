# 68 – System społecznościowy (zbiorczy)

Task zbiorczy z taska [53](53-social-system-plan.md), decyzja D80 (cała). Subtaski 69–91 realizowane w kolejności tabeli w `README.md`, w przebiegu bez nadzoru (skill `/autorun`). Szczegóły, kryteria i testy w plikach subtasków.

## Zakres

- Subtaski: 69 fundament, 70 profil, 71 obserwowanie, 72 biblioteka, 73 postęp czytania, 74 zakładki i notatki, 75 feed, 76 komentarze, 77 reakcje, 78 oceny, 79 moderacja autora, 80 zgłoszenia, 81 powiadomienia, 82 wzmianki, 83 statystyki, 84 rankingi, 85 DM, 86 blokowanie, 87 fora, 88 panel admina, 89 usuwanie konta, 90 realtime, 91 audyt.
- Pakiety z zamkniętej listy D80 (`recharts`, `cmdk`, `sonner`) zainstalowane przed przebiegiem w pierwszym commicie brancha: „68: add approved social packages” (zrobione). Innych pakietów nie dodajemy.
- Okresowy merge `develop` → `feature/social` (agent `merger`), z `npm run verify` po merge'u.

## Branche

- `feature/social` z `develop`, lokalny, nie pushowany (D80).
- Subtaski: `feature/NN-<slug>` z aktualnego `feature/social`; po zakończeniu jeden commit `NN: <krótki opis>`, status `[x]`, plik do `done/`, merge do `feature/social`.
- Do `develop` merguje użytkownik po przeglądzie całości.

## Kryteria akceptacji

1. Kryteria wszystkich subtasków 69–91 spełnione albo task oznaczony „Blokada” z opisem (D80, przebieg).
2. `npm run verify` na `feature/social` przechodzi po ostatnim subtasku i po ostatnim merge'u `develop`.
3. Audyt bezpieczeństwa (task 91) bez otwartych krytycznych uwag.
4. `README.md` (opis i stack) oraz `docs/deploy.md` (`REALTIME_PUBLIC_URL`, usługa SSE na serwerze narzędzi wymagana przed wydaniem, migracje kategorii forum) zaktualizowane.
5. Wszystkie rozstrzygnięcia Claude'a z przebiegu dopisane w D80 („do potwierdzenia”).

## Testy

Testy z plików subtasków. `manual`: kryterium 3 (raport audytu w tasku 91), 4 i 5 (przegląd użytkownika przed merge'em do `develop`).

## Wynik (2026-11-11)

Wszystkie subtaski 69–91 zrobione (`[x]`), bez blokad. Końcowy `npm run verify` na `feature/social` (d06fb5e) zielony: Vitest 4948, E2E 343. Końcowy audyt bezpieczeństwa w tasku 91: brak krytycznych uwag, wysokie i średnie poprawione. `feature/social` do `develop` merguje użytkownik po przeglądzie.
