# 111 – Wspólne stany puste i Badge

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B5, B16). Branch `feature/111-empty-states-badge` z `fix/ui-2`, merge do `fix/ui-2`.

## Zakres

- `components/ui/empty.tsx` (wzorzec z `feed/page.tsx:34-43`: ikona, tekst, opcjonalna akcja) i użycie w: `books/page.tsx` („Nowa książka”), `messages/page.tsx` („Nowa wiadomość”), `library/page.tsx` (link do wyszukiwarki), `moderation/page.tsx`, `components/notifications.tsx` (krótkie wyjaśnienie, co wywołuje powiadomienia), `public-search.tsx`, `feed/page.tsx`.
- `components/ui/badge.tsx` (shadcn, warianty domyślny/destrukcyjny/outline/secondary) zamiast ręcznych pigułek `rounded-full` w `tag-chips.tsx`, `tag-filter.tsx`, `moderation/page.tsx`, `messages/page.tsx`, `app-sidebar.tsx`, `notifications.tsx`, `settings-dialog.tsx`, `name-generator.tsx`. Wygląd bez zmian poza ujednoliceniem.

## Kryteria akceptacji

1. Każdy z wymienionych pustych widoków ma ikonę, tekst i (gdzie sens) akcję.
2. Pigułki w wymienionych plikach używają `Badge`.
3. Brak regresji w jasnym i ciemnym motywie.

## Testy

- E2E: zaktualizowane selektory istniejących specyfikacji; nowe asercje pustych stanów na `/books` (nowe konto), `/messages`, `/library` (1); (2) pokryte istniejącymi testami tagów i moderacji; (3) `manual` (`ui-checker`).
