# 104 – Wiadomości i aktualności

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/104-messages-feed` z `fix/ui`, merge do `fix/ui`. Użyj skilla `social-checklist`.

## Zakres

- Lista rozmów: jedna linia podglądu ostatniej wiadomości (ucięta, zwykły tekst bez markdownu), pogrubienie i kropka dla nieprzeczytanych (6.4), czas względny (94).
- Licznik nieprzeczytanych rozmów przy „Wiadomości” w sidebarze (miejsce z 95), odświeżany tak jak licznik powiadomień (realtime, D80).
- Aktualności (`feed/page.tsx`): jeden wyróżniony link na wpis (tytuł rozdziału, pogrubiony), autor i książka jako linki bez podkreślenia (podkreślenie przy hover/focus) (5.2).
- Podgląd i licznik respektują blokady i usunięte konta jak widok rozmowy.

## Kryteria akceptacji

1. Lista rozmów pokazuje podgląd ostatniej wiadomości i wyróżnia nieprzeczytane.
2. Licznik w sidebarze zgadza się z liczbą nieprzeczytanych rozmów i znika po przeczytaniu.
3. Wpis aktualności ma jeden podkreślony link.

## Testy

- Integracyjne: `direct-messages.test.ts` – podgląd i liczba nieprzeczytanych (1, 2; blokada, cudza rozmowa).
- E2E: `direct-messages.spec.ts` (1, 2), `feed.spec.ts` (3).
