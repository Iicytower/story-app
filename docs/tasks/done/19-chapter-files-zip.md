# 19 – Zip z osobnym plikiem na rozdział

Zgłoszenie użytkownika (2026-10-30): eksport całego folderu jako zip z plikami w wybranym formacie. Decyzje: D32.

## Zakres

- Przełącznik „One file per chapter (.zip)” w dialogu „Export as…” na stronie folderu, dla każdego formatu.

## Kryteria akceptacji

1. Zip zawiera po jednym pliku na rozdział, ponumerowane w kolejności folderu.
2. Działa dla każdego formatu z D31.
3. Notatki folderu trafiają do zipa tylko z „Include comments and notes”.
4. Przełącznik nie pojawia się przy eksporcie rozdziału.

## Testy

- Jednostkowe: `lib/export/formats.test.ts`, `buildChapterFilesZip` (1, 3).
- E2E: `tests/e2e/export-formats.spec.ts`, zip `.docx` i `.pdf` (1, 2), brak przełącznika w rozdziale (4). Pozostałe formaty idą tą samą ścieżką co `buildExport`, sprawdzaną dla każdego formatu w tasku 17.
