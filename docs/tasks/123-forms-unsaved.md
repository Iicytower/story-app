# 123 – Formularze (`Field`) i niezapisane zmiany

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B15, B18). Branch `feature/123-forms-unsaved` z `fix/ui-2`, merge do `fix/ui-2`. Zależy od 122.

## Zakres

- `components/ui/field.tsx` (shadcn: etykieta, opis, błąd; `aria-describedby`, `aria-invalid`) i użycie w `login-form.tsx`, formularzu rejestracji, dialogach tworzenia książki i rozdziału, zmianie hasła, `action-form.tsx` (wspólny wrapper). Najpierw sprawdzić, które formularze już spełniają wymagania, i nie ruszać ich bez powodu.
- Błąd inline przy polu, fokus na pierwszym polu z błędem, `autocomplete` i `spellCheck={false}` dla nicku, haseł i kodów odzyskiwania.
- Niezapisane zmiany: ostrzeżenie przy nawigacji wewnętrznej (klik w sidebar/link) z notatek i ustawień, gdy pole jest „brudne” (status „Niezapisane zmiany” z D99); `beforeunload` w `editor.tsx` i `folder-notes.tsx` bez zmian.

## Kryteria akceptacji

1. Błędy walidacji są powiązane z polem (`aria-describedby`/`aria-invalid`) i fokus trafia na pierwsze błędne pole.
2. Pola nicku/hasła/kodu mają `autocomplete` i wyłączone sprawdzanie pisowni.
3. Przejście z brudnych notatek innym linkiem pyta o potwierdzenie; z czystych – nie.

## Testy

- E2E: `login.spec.ts`, `registration.spec.ts`, `change-password.spec.ts` rozszerzone o asercje `aria-invalid` i fokusu (1, 2); `unsaved-warning.spec.ts` (3).
