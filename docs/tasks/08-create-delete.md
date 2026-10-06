# 08 – Tworzenie i usuwanie opowiadań

Spec: „Lista opowiadań”, „Server Actions i Route Handlers”.

## Zakres

- Server Action `createStory(title)`: sprawdza sesję, `EMPTY_TITLE`, `DUPLICATE_TITLE`; tworzy z pustą treścią i notatkami oraz `userId` z sesji; zwraca `id`.
- Modal shadcn (Dialog) na `/stories` z polem tytułu; po sukcesie przejście do `/stories/[id]`; błąd wyświetlany w modalu.
- Server Action `deleteStory(id)`: soft delete (`deletedAt = now`), `NOT_FOUND` dla nieistniejących/usuniętych/cudzych.
- Przycisk usuwania na liście z potwierdzeniem (AlertDialog). (Przycisk w edytorze – task 09.)
- Wspólny typ wyniku akcji: `{ ok: true, ... } | { ok: false, error, message }`.

## Kryteria akceptacji

- Duplikat tytułu w obrębie użytkownika (wielkość liter ma znaczenie) blokowany, tytuł usuniętego dozwolony.
- Akcja bez sesji zwraca `UNAUTHORIZED`.

## Testy

- Integracyjne `createStory`: sukces (pusta treść, `userId` z sesji), `EMPTY_TITLE` (także same spacje – ustalić z użytkownikiem, jeśli niejasne), `DUPLICATE_TITLE`, brak sesji → `UNAUTHORIZED`.
- Integracyjne `deleteStory`: ustawia `deletedAt`, ponowne → `NOT_FOUND`, cudze → `NOT_FOUND` i dokument nietknięty.
- E2E `tests/e2e/create-delete.spec.ts`: modal → przejście do edytora; błąd duplikatu w modalu; usunięcie z listy z potwierdzeniem i anulowanie potwierdzenia.
