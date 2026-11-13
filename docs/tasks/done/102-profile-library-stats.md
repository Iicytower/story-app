# 102 – Profil, biblioteka, statystyki

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport `docs/ui-ux-report.md` (usunięty 2026-11-13, dostępny w historii gita) (numery punktów w nawiasach). Branch `feature/102-profile-library-stats` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Własny profil publiczny: przycisk „Edytuj profil” otwierający ustawienia na zakładce Profil (101) (6.6).
- Biblioteka: checkbox „Biblioteka publiczna” z opisem przeniesiony do „Zarządzaj półkami” (5.1).
- Statystyki: `isAnimationActive={false}` na seriach recharts, szkielet o stałej wysokości w miejscu wykresu, opis „Książki i rozdziały” w jednym zdaniu (5.3).

## Kryteria akceptacji

1. Na własnym profilu jest „Edytuj profil”, na cudzym nie.
2. Ustawienie biblioteki publicznej działa z „Zarządzaj półkami” i nie ma go nad zakładkami.
3. Wykres nie animuje się, a miejsce na niego nie zmienia wysokości przy ładowaniu.

## Testy

- E2E: `profile.spec.ts` (1), `library.spec.ts` (2), `stats.spec.ts` (3 – wysokość kontenera przed i po renderze, brak `isAnimationActive` sprawdzony unitem lub `manual`).
