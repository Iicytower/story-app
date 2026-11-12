# 107 – Audyt końcowy UI/UX i raport po poprawkach

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/107-ui-audit` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Dev server w tle na porcie 3000 (`npm run dev`, logi do pliku w scratchpadzie), lokalna baza z `npm run seed` (konta `seed_*`, jak w raporcie).
- `ui-checker` przez Playwright MCP, szczegółowo: wszystkie ekrany z raportu w 8 wariantach (1280/375 × jasny/ciemny × `pl`/`en`) oraz obszary niesprawdzone w raporcie (sekcja 10): puste stany nowego konta, komunikaty błędów (złe logowanie, nieudany zapis), nawigacja samą klawiaturą i widoczność focusu, wyniki wyszukiwania, menu ⋮ wiersza książki, mobile na wszystkich stronach.
- Drobne poprawki (CSS, teksty, `aria-label`, focus, przepełnienia) robi `implementer` w tym tasku; większe problemy trafiają do backlogu w `docs/tasks/README.md` z opisem.
- Raport `docs/ui-ux-report-after.md` w formacie `docs/ui-ux-report.md` (ocena 0–10, top 10, sekcje, porównanie z oceną 6/10 i status każdego punktu raportu), zrzuty w `docs/ui-ux-report-after/`.

## Kryteria akceptacji

1. Raport po poprawkach istnieje, ma ocenę i status każdego punktu pierwotnego raportu.
2. Obszary z sekcji 10 raportu zostały sprawdzone i opisane.
3. Poprawki z audytu mają testy albo są oznaczone `manual` w raporcie.
4. `npm run verify` na `fix/ui` przechodzi.

## Testy

- `manual`: 1, 2 (przegląd raportu przez użytkownika).
- E2E dla poprawek, które zmieniają zachowanie (focus, klawiatura, błędy) (3); 4 – końcowy `npm run verify`.
