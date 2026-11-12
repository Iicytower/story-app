# D33 – Tylko przycisk „Export as…” (2026-10-30)

Status: aktualna.

- Decyzja użytkownika: z UI znikają przyciski „Export .md” i „Export .zip”. W edytorze i na stronie folderu zostaje „Export as…” (D31, D32). Zmiana dotyczy wyłącznie przycisków.
- Wszystkie formaty zostają. Trasy `GET /stories/[id]/export` i `GET /folders/[id]/export` (D10, D18) oraz frontmatter działają bez zmian, ale UI do nich nie prowadzi.
- Zapis przed eksportem, konflikt z inną kartą i pusty tytuł sprawdzają testy dialogu.
