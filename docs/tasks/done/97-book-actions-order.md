# 97 – Główne akcje i kolejność rozdziałów

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport `docs/ui-ux-report.md` (usunięty 2026-11-13, dostępny w historii gita) (numery punktów w nawiasach). Branch `feature/97-book-actions-order` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Lista książek (`/books`): widoczny przycisk główny „Nowa książka”; jeśli dotychczasowe „Nowe opowiadanie” tworzyło rozdział w domyślnym folderze, obok przycisk drugorzędny „Nowy rozdział”; w menu ⋮ zostają sortowanie, import i akcje rzadkie (3.2).
- Strona książki (`/books/[id]`): widoczny przycisk główny „Nowy rozdział”.
- `lib/folders/sort.ts` `chapterOrder("created")`: `{ createdAt: 1, _id: 1 }` (3.3, D17 zmieniona w D83). Dotyczy listy, panelu Chapters, eksportu, wersji i strony publicznej (wspólne `chapterOrder`). Bez migracji danych. Etykieta trybu w UI („Od pierwszego” / „Oldest first”).
- `npm run seed` bez zmian logiki, ale sprawdzić, że dane wyglądają sensownie w nowej kolejności.

## Kryteria akceptacji

1. „Nowa książka” i „Nowy rozdział” są widoczne bez otwierania menu i działają jak dotychczasowe pozycje menu.
2. W trybie `created` rozdziały są od najstarszego w liście, panelu Chapters, eksporcie i na stronie publicznej.

## Testy

- Unit: `lib/folders/sort.test.ts` (2).
- Integracyjne: `tests/integration/sorting.test.ts`, eksport (`folders-export.test.ts`) – kolejność (2).
- E2E: `create-delete.spec.ts`, `sorting.spec.ts`, `export.spec.ts`, `export-formats.spec.ts` (1, 2).
