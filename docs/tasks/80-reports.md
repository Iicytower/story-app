# 80 – Zgłoszenia

Subtask 68, zależy od 79. Podstawa: D80 (Role, bany, blokady – zgłoszenia). Branch `feature/80-reports` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `reports` (`reporterId`, `targetType: comment | post | story | folder | profile`, `targetId`, `route: author | admin`, `authorId?`, `reason` (lista: spam, nękanie, treść nielegalna, 18+ bez oznaczenia, inne), `details` (`MAX_REPORT_LENGTH`), `state: open | resolved | dismissed`, `resolvedBy?`, `resolvedAt?`, `createdAt`; unikalny `{ reporterId, targetType, targetId, state: open }` – jedno otwarte zgłoszenie obiektu od osoby).
- Trasa z D80: komentarz i post forum autora → `author` (autor i moderatorzy); rozdział, książka, profil, posty forów globalnych → `admin`.
- Akcje `report(...)` (limit 20/dobę, `canInteract` nie dotyczy – zablokowany też może zgłosić), `resolveReport(id, outcome)` dla uprawnionych, z wpisem w `moderationLog`.
- UI: „Zgłoś” w menu ⋮ komentarza, na stronie czytania, spisie i profilu (dialog z powodem); zakładka „Zgłoszenia” w `/moderation`; kolejka admina w 88 (tu tylko zapytanie `listAdminReports`). Haki powiadomień: nowe zgłoszenie, wynik dla zgłaszającego (81).

## Kryteria akceptacji

1. Zgłoszenie trafia do właściwej trasy wg typu obiektu.
2. Autor i jego moderatorzy widzą i rozstrzygają tylko zgłoszenia swojej społeczności; inni → `NOT_FOUND`.
3. Drugie otwarte zgłoszenie tego samego obiektu od tej samej osoby jest odrzucane; limit dobowy działa.
4. Rozstrzygnięcie zapisuje stan i wpis w logu.

## Testy

- Integracyjne: `tests/integration/reports.test.ts` (1–4).
- E2E: `tests/e2e/reports.spec.ts` (`dave` zgłasza komentarz `erin` pod tekstem `alice`, `alice` rozstrzyga).
