# 125 – Audyt końcowy UI/UX i raport po poprawkach

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport `docs/ui-ux-report.md`, D84 (warianty `ui-checker`). Branch `feature/125-ui-audit-2` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 109–124.

## Zakres

- `ui-checker` na uruchomionym dev serwerze (po `npm run seed`): wszystkie 8 wariantów (1280 i 375 × jasny i ciemny × `/en` i `/pl`) dla stron objętych raportem oraz obszarów, których audyt wyjściowy nie sprawdził (jasny motyw mobile, przepływy wiadomości i publikacji, 404 zalogowanego, fokus klawiaturą). Mniejsze usterki trafiają do `implementer` w tym samym tasku.
- `docs/ui-ux-report-after.md`: ocena 0–10, porównanie z punktami A1–A15 i B1–B18 (zrobione / częściowo / pominięte z powodem), nowe znaleziska. Bez screenshotów w repo (jak po e9b80ff).
- Pozostałe otwarte znaleziska dopisane jako backlog w `README.md`.

## Kryteria akceptacji

1. Raport po poprawkach istnieje i pokrywa każdy punkt A1–A15, B1–B18.
2. Brak błędów konsoli i CSP oraz poziomego scrolla na 375 px na sprawdzonych stronach.
3. `npm run verify` przechodzi.

## Testy

- `manual` (1): przegląd raportu przez użytkownika. (2) `ui-checker`. (3) `verifier` z pełnym `npm run verify` na `fix/ui-2`.
