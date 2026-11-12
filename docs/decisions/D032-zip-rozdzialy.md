# D32 – Zip z osobnym plikiem na rozdział (2026-10-30)

Status: aktualna.

- Uzupełnia D31. W dialogu „Export as…” na stronie folderu przełącznik „One file per chapter (.zip)” działa dla każdego formatu. Plik `<nazwa folderu>.zip` budowany w przeglądarce (`buildChapterFilesZip`), rozdziały nazwane jak w D18 (`NN-<nazwa>.<rozszerzenie>`).
- Każdy rozdział to osobny dokument z tytułem rozdziału, także przy `.epub`, `.fb2`, `.pdf`. Przełącznik „Include comments and notes” działa jak w D31, a notatki folderu trafiają do `notes.<rozszerzenie>`.
- „Export .zip” (D18) zostaje bez zmian: tylko on daje `.md` z frontmatterem i zawsze zawiera notatki.
