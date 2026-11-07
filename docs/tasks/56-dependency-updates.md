# 56 – Aktualizacja Next.js i podatnych zależności

Z testów bezpieczeństwa 2026-11-07 ([F1](../security/pentest-2026-11-07.md#f1--podatne-zależności-wysoka)).

## Zakres

- `next` do najnowszej 16.x z poprawkami (co najmniej 16.4.5): GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r.
- `npm audit fix` dla zależności przechodnich bez zmian major (`undici`, `zod`, `body-parser`, `systeminformation`, `fast-uri`, `qs`, `ip-address`, `minimatch`, `deepmerge`).
- Przed zmianą przeczytać notatki wydania Next.js 16.4 (`node_modules/next/dist/docs/`) pod kątem zmian w proxy, Server Actions i `next-intl`.

## Kryteria akceptacji

1. `npm audit --omit=dev` nie zgłasza podatności critical ani high w `next`.
2. Pozostałe zgłoszenia `npm audit --omit=dev` są naprawione albo opisane w raporcie jako nieosiągalne (np. tylko w CLI `shadcn`).
3. Aplikacja działa jak przed aktualizacją.

## Testy

`npm run verify` w całości (regresja). `manual`: wynik `npm audit --omit=dev` przed i po; deploy na staging.
