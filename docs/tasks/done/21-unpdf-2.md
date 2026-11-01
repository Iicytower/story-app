# 21 – Aktualizacja unpdf do 2.x

Zgłoszenie użytkownika (2026-10-30). Wymaga Node 24 (D34).

## Zakres

- `unpdf` z 1.x do 2.x, bez zmian w działaniu importu `.pdf`.

## Kryteria akceptacji

1. Import `.pdf` działa w Node (testy) i w przeglądarce (E2E).
2. `npm run verify` przechodzi na Node 24.

## Testy

Istniejące: `reads a PDF as one chapter…` w `lib/import/parse.test.ts`, `imports an exported .pdf in the browser` w `tests/e2e/import.spec.ts`.
