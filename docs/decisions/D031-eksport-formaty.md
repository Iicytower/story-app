# D31 – Eksport do nowych formatów w przeglądarce (2026-10-30)

Status: aktualna.

- Formaty: `.docx`, `.odt`, `.pdf`, `.epub`, `.fb2`, `.html`, `.txt`, `.md` (jeden plik). Dotyczą rozdziału i folderu; folder to jeden dokument z rozdziałami w kolejności folderu. „Export .md” (D10) i „Export .zip” (D18) zostają bez zmian jako pełny backup.
- Limit 4,5 MB obejmuje na Vercelu też odpowiedzi, na każdym planie. Dlatego `GET /stories/[id]/export/data` i `/folders/[id]/export/data` zwracają tylko tekst w JSON, a plik buduje przeglądarka. Limit dotyczy samego tekstu. Generatory są ładowane przez `import()` po kliknięciu, więc nie powiększają stron.
- Model: `parseBlocks` (`lib/export/blocks.ts`, lexer `marked` z `breaks` i `gfm`, jak D20) daje wspólne bloki dla rendererów w `lib/export/formats/`. Surowy HTML jest pomijany (D8, D20), linki tylko `http:`, `https:`, `mailto:`. Nagłówki `h4`–`h6` ze Source spadają do poziomu 3. `.md` to surowe źródło, więc zawiera też surowy HTML, jak D10.
- Dialog „Export as…”: przełącznik „Include comments and notes”, domyślnie wyłączony. Włączony dodaje komentarze w nawiasach kwadratowych kursywą, notatki rozdziału pod jego tekstem i notatki folderu na końcu.
- `.epub` i `.odt` bez pakietu: ręczne XML + `fflate`. `.docx` przez `docx`, `.pdf` przez `pdfkit` (build przeglądarkowy wybierany przez `exports`). Typy `pdfkit` we własnym `types/pdfkit.d.ts`. PDF osadza DejaVu Serif z `public/fonts/` (polskie znaki, licencja obok plików); znaki spoza fontu, np. emoji, nie zostaną poprawnie narysowane.
- Rozdział: „Export as…” przed pobraniem danych zapisuje przez tę samą kolejkę co „Export .md” (D10).
