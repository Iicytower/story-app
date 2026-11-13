# 124 – Powiadomienia: grupowanie i „oznacz wszystkie”

Model: opus

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md) (bez e-maili), raport (B14), D94. Użyć skilla `social-checklist`. Branch `feature/124-notifications-grouping` z `fix/ui-2`, merge do `fix/ui-2`.

## Zakres

- `components/notifications.tsx` i zapytanie o powiadomienia: grupowanie podobnych zdarzeń po (typ, obiekt) w wyświetlaniu, np. „5 osób zareagowało na Twój rozdział” (plural ICU, rozwijalna lista); dane nadal tylko adresata (`userId` z sesji), bez zmian w sposobie tworzenia powiadomień.
- „Oznacz wszystkie jako przeczytane” (Server Action z sesją) i przełącznik „Tylko nieprzeczytane”.
- Zachować grupy „Dzisiaj/Wcześniej” i czas względny (D83).
- Bez e-maili, digestu i pushów (D85).

## Kryteria akceptacji

1. Wiele reakcji na ten sam obiekt pokazuje się jako jedna pozycja ze licznikiem; rozwinięcie pokazuje osoby.
2. „Oznacz wszystkie” zeruje licznik nieprzeczytanych (w sidebarze też).
3. Filtr „Tylko nieprzeczytane” ukrywa przeczytane.
4. Użytkownik nigdy nie widzi ani nie oznacza cudzych powiadomień.
5. Zablokowani i zbanowani autorzy nie pojawiają się w grupach (reguły z D80).

## Testy

- Integracyjny: `notifications.test.ts` rozszerzony – agregacja, mark all, izolacja po `userId`, blokady (1, 2, 4, 5). E2E: `notifications.spec.ts` – grupa, „Oznacz wszystkie”, filtr (1, 2, 3).
