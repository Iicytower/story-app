# 07 – Tworzenie i usuwanie opowiadań

Spec: „Lista opowiadań”, „Server Actions i Route Handlers”.

## Zakres

- Server Action `createStory(title)`: sprawdza sesję, `EMPTY_TITLE`, `DUPLICATE_TITLE`; tworzy z pustą treścią i notatkami oraz `userId` z sesji; zwraca `id`.
- Modal shadcn (Dialog) na `/stories` z polem tytułu; po sukcesie przejście do `/stories/[id]`; błąd wyświetlany w modalu.
- Server Action `deleteStory(id)`: soft delete (`deletedAt = now`), `NOT_FOUND` dla nieistniejących/usuniętych/cudzych.
- Przycisk usuwania na liście z potwierdzeniem (AlertDialog). (Przycisk w edytorze – task 08.)
- Wspólny typ wyniku akcji: `{ ok: true, ... } | { ok: false, error, message }`.

## Kryteria akceptacji

- Duplikat tytułu w obrębie użytkownika (wielkość liter ma znaczenie) blokowany, tytuł usuniętego dozwolony.
- Akcja bez sesji zwraca `UNAUTHORIZED`.
