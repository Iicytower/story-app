# 73 – Postęp czytania i nowe rozdziały

Subtask 68, zależy od 72. Podstawa: D80 (Profil, relacje, biblioteka – postęp). Branch `feature/73-reading-progress` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `readingProgress` (`userId`, `folderId`, `lastStoryId`, `position` 0–1, `readStoryIds: ObjectId[]`, `updatedAt`; unikalny para). Tylko zalogowani.
- Strona czytania rozdziału zapisuje pozycję przewinięcia (throttle 10 s i przy opuszczeniu strony, akcja `saveReadingPosition`), a przewinięcie do końca dopisuje rozdział do `readStoryIds`. Akcja sprawdza publiczność rozdziału.
- „Czytaj dalej”: na publicznym spisie książki i w bibliotece; otwiera ostatni rozdział i przewija do zapisanej pozycji.
- Nowe rozdziały: liczba publicznych rozdziałów książki z biblioteki opublikowanych po `addedAt` (z `publishedAt`, D54) i nieobecnych w `readStoryIds`; znaczek w bibliotece i oznaczenie „nowy” w spisie. Hak dla powiadomień „nowy rozdział” (81).

## Kryteria akceptacji

1. Przewinięcie rozdziału zapisuje pozycję; „Czytaj dalej” wraca do tego rozdziału i miejsca (tolerancja kilku procent).
2. Przewinięcie do końca oznacza rozdział jako przeczytany.
3. Licznik nowych rozdziałów rośnie po publikacji nowego rozdziału i maleje po jego przeczytaniu.
4. Zapis postępu dla niepublicznego lub cudzego-niewidocznego rozdziału → `NOT_FOUND`; gość nic nie zapisuje.

## Testy

- Unit: `lib/social/new-chapters.test.ts` (wyliczanie nowych).
- Integracyjne: `tests/integration/reading-progress.test.ts` (2, 3, 4).
- E2E: `tests/e2e/reading-progress.spec.ts` (1 – `dave` czyta rozdział `alice`, przeładowanie, „Czytaj dalej”; 3 – `alice` publikuje nowy rozdział).
