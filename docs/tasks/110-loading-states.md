# 110 – Stany ładowania i szkielety

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B2, A3). Branch `feature/110-loading-states` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 109.

## Zakres

- `components/ui/skeleton.tsx` (shadcn, tylko CSS; `motion-safe:animate-pulse`, stała wysokość, bez przesuwania układu).
- `loading.tsx` z szkieletem dla: `(protected)` (ogólny), `books`, `feed`, `messages`, `library`, `p/[nickname]/…`. Sprawdzić `node_modules/next/dist/docs/` dla `loading.js`.
- Wykres w `/stats` i panel „Notatki książki” w `/books/[id]`: szkielet lub „Ładowanie…” z `aria-busy` do czasu doładowania edytora/wykresu.
- Edytor rozdziału na mobile: szkielet zamiast pustki przez kilka sekund (układ edytora zostaje w 112).

## Kryteria akceptacji

1. Przejście do listy książek, feedu, wiadomości, biblioteki i strony publicznej pokazuje szkielet do czasu odpowiedzi serwera.
2. `/stats` i notatki książki nie wyglądają na puste podczas ładowania.
3. Szkielety respektują `prefers-reduced-motion`.

## Testy

- E2E: spowolnione żądanie (route handler/`page.route`) pokazuje szkielet na `/books` (1) i `/stats` (2); `manual`: (3) `emulate_media reduced-motion`.
