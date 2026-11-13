# 121 – Paleta poleceń i ściąga skrótów

Model: opus

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B8, B9). Branch `feature/121-command-palette` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 112.

## Zakres

- Globalna paleta poleceń Ctrl/Cmd+K (`CommandDialog` z `components/ui/command.tsx` i istniejącego `cmdk`, w `app-sidebar.tsx`): skok do własnej książki lub rozdziału (dane z Server Action z sesją, `userId` z sesji, `deletedAt: null`, limit wyników), „Nowa książka”, „Nowy rozdział”, „Ustawienia”, przełączniki motywu i języka. Tylko dla zalogowanych.
- `components/ui/kbd.tsx` (shadcn, same style) i dialog „Skróty klawiszowe” (po `?` poza polami tekstowymi oraz z menu „Narzędzia” edytora) z listą skrótów z `markdown-editor.tsx`, `find-panel.tsx`, `tags-dialog.tsx`; niełamliwe spacje w skrótach.
- Teksty w `messages/*.json`.

## Kryteria akceptacji

1. Ctrl+K otwiera paletę; wyszukanie własnej książki lub rozdziału i Enter przechodzi pod właściwy adres.
2. Paleta nie zwraca cudzych ani usuniętych treści.
3. Polecenia „Nowa książka”, „Ustawienia”, zmiana motywu i języka działają.
4. `?` poza polem tekstowym otwiera ściągę skrótów; w polu tekstowym wpisuje znak.

## Testy

- Integracyjny: `command-palette.test.ts` – wyniki tylko własne, bez `deletedAt` (2). E2E: `command-palette.spec.ts` (1, 3), `shortcuts-help.spec.ts` (4).
