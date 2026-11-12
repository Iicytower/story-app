# 101 – Dialog ustawień z zakładkami

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/101-settings-tabs` z `fix/ui`, merge do `fix/ui`.

## Zakres

- `components/settings-dialog.tsx`: zakładki (komponent `tabs` shadcn na `radix-ui`, D83) – Wygląd (motyw, język, edytor), Profil (avatar, „O mnie”, widoczność), Konto (hasło, kody odzyskiwania, sesje, usunięcie konta), Powiadomienia (7.1). Pionowo po lewej na desktopie, u góry na mobile. Przypisanie pól do zakładek według sensu, jeśli jest więcej sekcji.
- Otwieranie dialogu na wybranej zakładce (API dla „Edytuj profil” w 102 i dla menu konta z 95).
- Nazwa „Bio” → „O mnie” / „About me” wszędzie (6.6).

## Kryteria akceptacji

1. Każde dotychczasowe ustawienie jest dostępne w jednej z czterech zakładek i działa.
2. Dialog otwiera się na wskazanej zakładce.
3. Na 375 px zakładki mieszczą się bez poziomego przewijania strony.

## Testy

- E2E: `settings.spec.ts`, `change-password.spec.ts`, `recovery.spec.ts`, `sessions.spec.ts`, `account-deletion.spec.ts`, `notifications.spec.ts` zaktualizowane do zakładek (1); test otwarcia na zakładce Profil (2); 375 px (3).
