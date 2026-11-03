# 47 – Usunięcie trybu kolumn w edytorze

Zgłoszenie użytkownika (2026-11-03). Przycisk „Split” zamienia prawy panel (Notes, Chapters, Tools) w osobne kolumny. Tryb kolumn znika razem z kodem; zostaje panel boczny z zakładkami (D51).

## Zakres

- Usunięcie przycisku „Split” z paska edytora.
- Usunięcie trybu kolumn: kolejność kolumn (`order`, `moveColumn`), przyciski „Move left/right” w nagłówku kolumny, szerokości osobnych zestawów kolumn (`widthsKey` dla kolumn) i uchwyty między kolumnami.
- `lib/editor-layout.ts`: `split` i `order` znikają z typu i domyślnego układu; `normalizeLayout` ignoruje je w zapisanych danych, więc użytkownik z zapisanym `split: true` dostaje zakładki.
- Zostaje bez zmian: panel boczny z zakładkami, wybrana zakładka, chowanie i pokazywanie panelu, jego szerokość, wysokość notatek folderu, widok mobilny.
- Usunięcie nieużywanych tekstów z `messages/en.json` i `messages/pl.json` (`split`, `moveLeft`, `moveRight` i podobne).

## Ustalenia

- Usuwamy też kod pod spodem, nie tylko przycisk (decyzja użytkownika).
- Bez migracji: stare pola `split`, `order` i szerokości kolumn w bazie są ignorowane przy odczycie i nadpisywane przy kolejnym zapisie układu.

## Kryteria akceptacji

1. W edytorze nie ma przycisku „Split” ani trybu kolumn.
2. Panel boczny z zakładkami, chowanie panelu i jego szerokość działają jak dotąd i zostają po przeładowaniu.
3. Użytkownik z zapisanym `split: true` widzi panel z zakładkami, bez błędu.
4. W kodzie i słownikach nie zostaje nic po trybie kolumn.

## Testy

Unit: `normalizeLayout` dla starych danych z `split`, `order` i szerokościami kolumn. E2E: brak przycisku „Split”, zakładki i chowanie panelu po przeładowaniu, stary zapis `split: true` (seed ustawień) daje zakładki; usunięte testy trybu kolumn w `editor-panels`, `settings`, `scroll-position` i `import`. `manual`: przegląd, że po trybie kolumn nie został kod ani teksty (grep `split`, `order`, `moveColumn`).
