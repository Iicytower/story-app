# D70 – Branch `security` i aktualizacja zależności (2026-11-09)

Status: archiwalna – branch `security` zmergowany do `develop`; TypeScript zostaje na 6.x, dopóki `typescript-eslint` nie obsługuje TS 7.

- Poprawki bezpieczeństwa (taski 56–63, aktualizacja zależności z 2026-11-09) idą na lokalny branch zbiorczy `security` z `develop`; branche tasków z niego. `security` nie jest pushowany, a do `develop` merguje go użytkownik po przeglądzie (decyzja użytkownika).
- Aktualizacja zależności łącznie z majorami, każdy osobno (decyzja użytkownika). TypeScript zostaje na 6.x: `typescript-eslint` nie obsługuje jeszcze TS 7. `@types/node` na 24.x (D34).
