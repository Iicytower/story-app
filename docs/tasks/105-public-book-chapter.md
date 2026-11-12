# 105 – Publiczna strona książki i rozdziału

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport [`docs/ui-ux-report.md`](../ui-ux-report.md) (numery punktów w nawiasach). Branch `feature/105-public-book-chapter` z `fix/ui`, merge do `fix/ui`. Użyj skilla `social-checklist`.

## Zakres

- Strona książki `/p/<nick>/<książka>`: okładka (`components/cover.tsx`, z obsługą 18+ jak na stronie głównej) i opis (`folders.description` z 98, zwykły tekst z zachowaniem nowych linii); „Czytaj dalej” jako przycisk główny, „W bibliotece” drugorzędny; średnia ocena jako liczba z liczbą ocen („3,8 · 12 ocen”), gwiazdki tylko jako „Twoja ocena” (6.7).
- Rozdział publiczny: bezpośrednio pod tekstem nawigacja „← Poprzedni” / „Następny rozdział →” (następny jako przycisk główny), potem reakcje, ocena rozdziału, zgłoszenie, komentarze. Obie oceny zostają. Pływający pasek zakładek z ramką zamiast cienia (6.8).

## Kryteria akceptacji

1. Strona książki pokazuje okładkę i opis; „Czytaj dalej” jest przyciskiem głównym.
2. Średnia jest liczbą, gwiazdki oznaczają tylko moją ocenę (gość widzi średnią bez gwiazdek do kliknięcia albo dialog logowania jak dotychczas).
3. Nawigacja do następnego rozdziału jest pierwszym elementem pod tekstem.

## Testy

- E2E: `publish.spec.ts` / `covers.spec.ts` (1), `ratings.spec.ts` (2), `reading-progress.spec.ts` lub nowy test w `publish.spec.ts` – kolejność elementów pod tekstem (3).
