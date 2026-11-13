# 80 – Zgłoszenia

Subtask 68, zależy od 79. Podstawa: D80 (Role, bany, blokady – zgłoszenia). Branch `feature/80-reports` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `reports` (`reporterId`, `targetType: comment | post | story | folder | profile`, `targetId`, `route: author | admin`, `authorId?`, `reason` (lista: spam, nękanie, treść nielegalna, 18+ bez oznaczenia, inne), `details` (`MAX_REPORT_LENGTH`), `state: open | resolved | dismissed`, `resolvedBy?`, `resolvedAt?`, `createdAt`). Unikalny `{ reporterId, targetType, targetId }` z `partialFilterExpression: { state: "open" }` – jedno otwarte zgłoszenie obiektu od osoby; drugie daje `E11000` → `INVALID_INPUT`.
- Trasa z D80: komentarz i post forum autora → `author` (autor i moderatorzy); rozdział, książka, profil, posty forów globalnych → `admin`. Typ `post` (trasa i test) dopisywany w 87. Zgłoszenie obiektu niewidocznego dla zgłaszającego (D38, ukryty) → `NOT_FOUND`. Ban globalny nie blokuje zgłoszeń.
- Akcje `report(...)` (limit 20/dobę, `canInteract` nie dotyczy – zablokowany też może zgłosić), `resolveReport(id, outcome)` dla uprawnionych, z wpisem w `moderationLog`.
- UI: „Zgłoś” w menu ⋮ komentarza, na stronie czytania, spisie i profilu (dialog z powodem); zakładka „Zgłoszenia” w `/moderation`; kolejka admina w 88 (tu tylko zapytanie `listAdminReports`). Haki powiadomień: nowe zgłoszenie, wynik dla zgłaszającego (81).
- Moderacja (79): zakładka Zgłoszenia w `/moderation` (dziś Ukryte, Bany, Moderatorzy, Log; URL `?community=<authorId>&tab=`); ukrycie i ban ze zgłoszenia przez akcje z `app/[locale]/(protected)/moderation/actions.ts` (`hideContent`, `banFromCommunity`), log w `moderationLog`.

## Kryteria akceptacji

1. Zgłoszenie trafia do właściwej trasy wg typu obiektu.
2. Autor i jego moderatorzy widzą i rozstrzygają tylko zgłoszenia swojej społeczności; inni → `NOT_FOUND`.
3. Drugie otwarte zgłoszenie tego samego obiektu od tej samej osoby jest odrzucane; limit dobowy działa.
4. Rozstrzygnięcie zapisuje stan i wpis w logu.
5. Gość klikający „Zgłoś” dostaje dialog logowania (D42).

## Testy

- Integracyjne: `tests/integration/reports.test.ts` (1–4).
- E2E: `tests/e2e/reports.spec.ts` (5 – gość i dialog logowania; `dave` zgłasza komentarz `erin` pod tekstem `alice`, `alice` rozstrzyga).
