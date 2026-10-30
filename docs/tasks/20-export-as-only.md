# 20 – Tylko „Export as…”

Zgłoszenie użytkownika (2026-10-30): usunąć „Export .md” i „Export .zip”. Decyzje: D33.

## Kryteria akceptacji

1. W edytorze i na stronie folderu nie ma „Export .md” ani „Export .zip”; zostaje „Export as…”.
2. Stare trasy eksportu nie istnieją, a nieużywany kod i frontmatter są usunięte.
3. Zapis przed eksportem, konflikt i pusty tytuł działają jak wcześniej.

## Testy

- E2E: `tests/e2e/export.spec.ts` (3), `tests/e2e/editor-mobile.spec.ts` (1), `tests/e2e/folder-share.spec.ts`.
- Integracyjne: `tests/integration/export-data.test.ts`.
- `manual`: `git grep` na stare nazwy (1, 2).
