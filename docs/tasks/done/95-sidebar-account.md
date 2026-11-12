# 95 – Sidebar: nazwa aplikacji, blok konta, pasek mobile

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/95-sidebar-account` z `fix/ui`, merge do `fix/ui`.

## Zakres

- `components/app-sidebar.tsx`: na górze nazwa aplikacji (link do `/`); na dole blok konta (avatar `UserAvatar` + nick) z menu: „Mój profil”, „Ustawienia” (otwiera dialog), „Wyloguj” (1.1). Wylogowanie usunięte z dialogu ustawień (D50 zmieniona w D83). Gość: nazwa aplikacji, bez bloku konta.
- „Feed” w `pl`: „Aktualności” (1.2). „Moderacja” na dole listy, nad blokiem konta. Miejsce na liczniki przy „Wiadomości” i „Moderacja” (wypełniają je 104 i 106).
- Mobile (`components/app-shell.tsx`): cienki stały pasek u góry z hamburgerem i nazwą aplikacji, treść pod nim bez nachodzenia (2.4).
- Dialogi i panele (`components/ui/dialog.tsx`, `alert-dialog.tsx`, panel powiadomień, logowanie): bez `backdrop-blur`, samo przyciemnienie (1.5).
- Zwijanie sidebara działa jak dotychczas, także z blokiem konta (zwinięty: sam avatar).

## Kryteria akceptacji

1. Zalogowany widzi nazwę aplikacji, swój avatar i nick; menu konta prowadzi do profilu, otwiera ustawienia i wylogowuje.
2. Dialog ustawień nie ma przycisku wylogowania.
3. „Aktualności” w `pl`; „Moderacja” nad blokiem konta.
4. Na 375 px pasek u góry z hamburgerem i nazwą, bez nachodzenia na nagłówek strony.
5. Żaden dialog nie ma klasy `backdrop-blur`.

## Testy

- Unit: `components/app-sidebar.test.tsx` (kolejność pozycji, blok konta, gość).
- E2E: `tests/e2e/layout.spec.ts` (1, 3, 4), testy wylogowania przeniesione z `settings.spec.ts`/`auth.spec.ts` na menu konta (1, 2); 5 – unit lub `grep` w teście komponentów UI.
