# 94 – Daty w lokalnej strefie i czas względny

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport `docs/ui-ux-report.md` (usunięty 2026-11-13, dostępny w historii gita) (numery punktów w nawiasach). Branch `feature/94-local-dates` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Wszystkie daty z godziną przez `LocalDate` (`components/local-date.tsx`): `feed/page.tsx`, `stats/page.tsx`, `moderation/page.tsx`, `admin/page.tsx`, `forum-views.tsx`, `comments.tsx`, `community-ban-notice.tsx`, `published-date.ts` i inne miejsca formatujące godzinę na serwerze z `timeZone: "UTC"` (8.1; `grep -rn 'timeZone: "UTC"'`). Daty bez godziny mogą zostać w UTC.
- Wariant względny (np. `LocalDate` z `relative`): `Intl.RelativeTimeFormat` w języku interfejsu, pełna data w `title`, odświeżanie bez animacji. Użyty w powiadomieniach (panel i strona) i na liście wiadomości (6.5).
- Powiadomienia pogrupowane „Dzisiaj” / „Wcześniej” (według lokalnej strefy).
- Bez przeskoku tekstu po hydratacji poza samą wartością (zarezerwowana szerokość lub `suppressHydrationWarning` jak dotychczas w `LocalDate`).

## Kryteria akceptacji

1. Ta sama chwila pokazuje tę samą godzinę na wersjach, moderacji, adminie, feedzie, forum i w komentarzach (strefa przeglądarki).
2. Powiadomienia i wiadomości pokazują czas względny w `pl` i `en`, pełna data w `title`.
3. Powiadomienia są w grupach „Dzisiaj” / „Wcześniej”.

## Testy

- Unit: `components/local-date.test.ts` (wariant względny: sekundy, minuty, godziny, dni; `pl` i `en`), funkcja grupowania powiadomień.
- E2E: `tests/e2e/dates.spec.ts` z `timezoneId: "Europe/Warsaw"` – ta sama godzina na moderacji i wersjach (1); `notifications.spec.ts` (2, 3).
