# 109 – Granice błędów, 404 w układzie aplikacji, tytuły kart

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport `docs/ui-ux-report.md` (B1, backlog). Branch `feature/109-error-boundaries` z `fix/ui-2`, merge do `fix/ui-2`.

## Zakres

- `app/[locale]/error.tsx`, `app/[locale]/(protected)/error.tsx` (z sidebarem, przycisk „Spróbuj ponownie” przez `reset`) i `app/global-error.tsx` (własne `<html>`/`<body>`). Teksty w `messages/en.json` i `messages/pl.json`.
- `app/[locale]/(protected)/not-found.tsx`: 404 w układzie aplikacji (sidebar, link do strony głównej). `/stats` konta bez publikacji jako pusty stan zamiast 404.
- `generateMetadata` w `books/[id]`, `chapters/[id]`, `versions/[number]`: tytuł karty z nazwą książki, rozdziału lub wersji zamiast ogólnych „Książka / Wersja / Edytor – Story App”.
- Sprawdzić `node_modules/next/dist/docs/` dla `error.js` i `not-found.js` (AGENTS.md).

## Kryteria akceptacji

1. Wyjątek w Server Component zalogowanej strony pokazuje błąd w układzie aplikacji z przyciskiem ponowienia.
2. Nieistniejący adres po zalogowaniu pokazuje 404 z sidebarem.
3. `/stats` konta bez publikacji pokazuje pusty stan.
4. Karta książki, rozdziału i wersji ma w tytule nazwę elementu.

## Testy

- E2E: nowy `error-pages.spec.ts` – 404 zalogowanego z sidebarem (2), `/stats` bez publikacji (3), tytuły kart (4). Błąd (1): test integracyjny/komponentowy `error.tsx` renderuje przycisk i wywołuje `reset`, albo `manual`.
