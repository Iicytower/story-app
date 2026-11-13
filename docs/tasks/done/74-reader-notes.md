# 74 – Zakładki i notatki czytelnika

Subtask 68, zależy od 73. Podstawa: D80 (Profil, relacje, biblioteka – zakładki i notatki). Branch `feature/74-reader-notes` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `readerMarks` (`userId`, `storyId`, `folderId`, `kind: bookmark | note`, `position` 0–1, `name?` (zakładka, do 100 znaków), `text?` (notatka, `MAX_READER_NOTE_LENGTH`), `quote?` (`MAX_QUOTE_LENGTH`), `prefix?`/`suffix?` (do 50 znaków kontekstu), `createdAt`, `updatedAt`). Indeks `{ userId, storyId }`. Prywatne: każde zapytanie po `userId` z sesji.
- Zakładka: przycisk na stronie czytania zapisuje bieżącą pozycję przewinięcia z opcjonalną nazwą. Notatka: po zaznaczeniu tekstu przycisk „Notatka” zapisuje cytat z kontekstem i tekst.
- Cytat, `prefix` i `suffix` pochodzą z `textContent` wyrenderowanej treści rozdziału. Kotwiczenie notatki przy odczycie (`lib/social/anchor.ts`, czysta funkcja na tym samym tekście, podawanym z klienta; podświetlenie robi `Range` po stronie klienta, serwer tylko waliduje długości): dokładne wyszukanie `prefix+quote+suffix`, potem samego `quote`, potem przybliżenie pakietem `diff`; brak → „osierocona” (wyświetlana na liście z zapisanym cytatem, bez podświetlenia).
- Panel „Zakładki i notatki” na stronie czytania (lista, przejście do miejsca, edycja, usunięcie) i lista przy książce w bibliotece.
- Limity: 200 na rozdział, 5000 na konto (razem), sprawdzane przed zapisem; przekroczenie o kilka przy równoległych zapisach akceptowane.
- Kolekcje taska dopisane do `purgeSocialData` (69); test: trwałe usunięcie rozdziału i folderu kasuje ich wpisy.

## Kryteria akceptacji

1. Zakładka zapisuje pozycję; kliknięcie na liście przewija do niej.
2. Notatka przy zaznaczeniu jest podświetlona w tekście i widoczna na liście.
3. Po edycji tekstu przez autora notatka trafia w przesunięty fragment albo jest oznaczona jako osierocona.
4. Notatki i zakładki widzi tylko ich właściciel (autor rozdziału też nie).
5. Limity długości i liczby odrzucają zapis z komunikatem.

## Testy

- Unit: `lib/social/anchor.test.ts` (3: przesunięcie, zmiana kontekstu, drobna zmiana cytatu, usunięcie).
- Integracyjne: `tests/integration/reader-marks.test.ts` (4 izolacja, 5 limity, niepubliczny rozdział → `NOT_FOUND`).
- E2E: `tests/e2e/reader-notes.spec.ts` (1, 2; 3 – `alice` zmienia akapit, `dave` widzi osieroconą).
