# 114 – Ustawienia czytania

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B4). Branch `feature/114-reading-settings` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 113.

## Zakres

- Przycisk „Aa” obok paska zakładek na stronie rozdziału publicznego (`p/[nickname]/[folder]/[chapter]/page.tsx`); popover (`components/ui/popover.tsx`): rozmiar tekstu, szerokość kolumny, krój (szeryf/sans), interlinia, „Przywróć domyślne”.
- Zapis w `localStorage` (try/catch; strona działa poprawnie bez niego), zmienne CSS na kontenerze `MarkdownPreview` (`--reader-size`, `--reader-width`, `--reader-font`, `--reader-leading`). Bez zmian schematu i Server Actions (D85).
- Wszystkie teksty w `messages/*.json`.

## Kryteria akceptacji

1. Zmiana ustawienia natychmiast zmienia wygląd tekstu rozdziału.
2. Ustawienia przetrwają przeładowanie i obowiązują w innych rozdziałach.
3. „Przywróć domyślne” wraca do wartości z 113.
4. Przycisk ma nazwę dostępną i działa klawiaturą.

## Testy

- E2E: `reader-settings.spec.ts` – zmiana rozmiaru zmienia `font-size` (1), po reload i w innym rozdziale (2), reset (3), `getByRole('button', { name })` + Enter/Escape (4).
