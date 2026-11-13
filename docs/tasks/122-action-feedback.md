# 122 – Feedback akcji: Sonner i Button `loading`

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B12). Branch `feature/122-action-feedback` z `fix/ui-2`, merge do `fix/ui-2`.

## Zakres

- `components/ui/spinner.tsx` i prop `loading` w `Button`: spinner (jak `components/ui/sonner.tsx`), `aria-busy`, przycisk wyłączony na czas żądania, tekst „Zapisywanie…” zostaje. Zastąpić ręczne `pending ? t("saving") : t("save")` w plikach, które do tego pasują, stopniowo (priorytet: ustawienia, tworzenie książki/rozdziału, logowanie, wiadomości) – nie przepisywać wszystkich ok. 36 miejsc na siłę.
- Krótkie potwierdzenia sukcesu (skopiowano link, dodano do biblioteki, zapisano ustawienia, opublikowano) przez Sonner (`toast`, `<Toaster>` już w `app-sidebar.tsx`) zamiast własnych `role="status"` tam, gdzie wiadomość znika sama. Błędy walidacji zostają inline przy polu. Komunikaty z `actionError`/`translateError` bez zmian.
- Bez cofania usuwania i bez zmian w dialogach potwierdzenia (D85).

## Kryteria akceptacji

1. Przyciski wskazanych formularzy pokazują spinner i są nieaktywne w trakcie żądania.
2. Wymienione potwierdzenia pojawiają się jako toast z `aria-live`.
3. Błędy walidacji pozostają inline przy polach.
4. Istniejące testy E2E przechodzą po zmianie selektorów.

## Testy

- E2E: asercje toastów (`getByRole('status')`/tekst) w `settings.spec.ts`, `library.spec.ts`, `publish.spec.ts` (2); spinner na spowolnionym żądaniu (1); istniejące testy błędów inline (3); (4) cały zestaw dotkniętych specyfikacji.
