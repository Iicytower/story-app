# 56 – Aktualizacja Next.js i podatnych zależności

Z testów bezpieczeństwa 2026-11-07 ([F1](../../security/pentest-2026-11-07.md#f1--podatne-zależności-wysoka)).

## Zakres

- `next` do najnowszej 16.x z poprawkami (co najmniej 16.4.5): GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r.
- `npm audit fix` dla zależności przechodnich bez zmian major (`undici`, `zod`, `body-parser`, `systeminformation`, `fast-uri`, `qs`, `ip-address`, `minimatch`, `deepmerge`).
- Przed zmianą przeczytać notatki wydania Next.js 16.4 (`node_modules/next/dist/docs/`) pod kątem zmian w proxy, Server Actions i `next-intl`.

Po aktualizacji sprawdzić, czy zmienił się próg z taska 62 (F8): blokada dekodera React Flight przy dużej treści `saveStory` zależy od wersji React/Next.

## Kryteria akceptacji

1. `npm audit --omit=dev` nie zgłasza podatności critical ani high w `next`.
2. Pozostałe zgłoszenia `npm audit --omit=dev` są naprawione albo opisane w raporcie jako nieosiągalne (np. tylko w CLI `shadcn`).
3. Aplikacja działa jak przed aktualizacją.

## Testy

`npm run verify` w całości (regresja). `manual`: wynik `npm audit --omit=dev` przed i po; deploy na staging.

## Wynik (2026-11-09)

Zrobione razem z zadaniem [aktualizacji zależności z 2026-11-09](dependency-updates-2026-11-09.md), na branchu zbiorczym `security`.

- `next` i `eslint-config-next` 16.3.8 → 16.4.6 (dokładne wersje), `react`/`react-dom` 19.3.1, `npm audit fix` bez `--force`.
- Notatki 16.4 (`node_modules/next/dist/docs/`): bez zmian w proxy, Server Actions i `next-intl`, które dotyczą aplikacji; `experimental.appNewScrollHandler` usunięte w 16.4 (aplikacja go nie używa).
- `npm audit --omit=dev`: przed 14 (1 critical, 6 high, 6 moderate, 1 low), po 6 (4 moderate, 2 low). Wszystkie pozostałe są w łańcuchu CLI `shadcn` (`@shadcn/registry` → `deepmerge`, `ts-morph` → `@ts-morph/common` → `minimatch`). Aplikacja importuje z `shadcn` tylko `shadcn/tailwind.css`, więc w runtime są nieosiągalne. Poprawka `minimatch` wymaga 11.x, a `@ts-morph/common` chce `^10`, więc bez `overrides` (zmiana major w cudzej zależności).
- Próg F8 po aktualizacji: patrz [task 62](../62-large-content-save.md).

Mapowanie kryteriów:
1. Brak critical/high w `next` – `manual`: `npm audit --omit=dev` (wyżej).
2. Pozostałe zgłoszenia opisane – wyżej.
3. Aplikacja działa – `npm run verify` (lint, typecheck, 2925 testów unit/integracyjnych, 262 E2E). `manual` (użytkownik): deploy na staging.
