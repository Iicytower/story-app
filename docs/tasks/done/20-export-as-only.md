# 20 – Tylko przycisk „Export as…”

Zgłoszenie użytkownika (2026-10-30): usunąć z UI przyciski „Export .md” i „Export .zip”, nic więcej. Decyzje: D33.

## Kryteria akceptacji

1. W edytorze i na stronie folderu nie ma „Export .md” ani „Export .zip”; zostaje „Export as…”.
2. Wszystkie formaty i trasy eksportu działają jak wcześniej.
3. Zapis przed eksportem, konflikt i pusty tytuł działają w dialogu.

## Testy

- E2E: `tests/e2e/export.spec.ts` (3), `tests/e2e/editor-mobile.spec.ts` (1), `tests/e2e/folder-share.spec.ts` (2).
- Integracyjne: `tests/integration/stories-export.test.ts`, `tests/integration/folders-share.test.ts`, `tests/integration/export-data.test.ts` (2).
