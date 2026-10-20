# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Wersja 1.0 (tag `v1.0.0`) jest na produkcji; taski dotyczą zmian po 1.0. Szczegóły tasku w `NN-<slug>.md` (sekcje Zakres, Kryteria akceptacji, Testy).

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione (zmergowane do `develop`), „odłożony” – wstrzymany decyzją użytkownika.

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 01 | [System migracji bazy](01-migrations.md) | – | [x] |
| 02 | [Foldery](02-folders.md) | 01 | [x] |
| 03 | [Tryby sortowania folderów i rozdziałów](03-sorting.md) | 02 | [x] |
| 04 | [Eksport i udostępnianie folderu](04-folder-export-share.md) | 03 | [x] |
| 05 | [Panele edytora: notatki folderu i rozdziały](05-editor-panels.md) | 03 | [x] |
| 06 | [Edytor WYSIWYG z trybem Source](06-wysiwyg-editor.md) | 05 | [x] |
| 07 | [Wyrównanie i kolor tekstu](07-align-color.md) | 06 | odłożony |

Nowe pakiety (instalacja po zgodzie użytkownika): `fflate` (04), shadcn Resizable / `react-resizable-panels` (05), Tiptap v3 (06, D20), `rehype-raw` + `rehype-sanitize` (07).

## Branche

- `main` – produkcja (Vercel Production). Nigdy nie pushujemy na `main`; merge ze `staging` przy wydaniu robi użytkownik.
- `staging` – środowisko testowe (Vercel Preview przypięty do brancha `staging`). Merge z `develop` na prośbę użytkownika.
- `develop` – integracja: tu trafiają zakończone taski.
- `feature/NN-<slug>` – jeden branch na task, tworzony z `develop`.

## Definicja „zrobione” (każdy task)

- Kryteria akceptacji z pliku taska spełnione, a testy z sekcji „Testy” napisane i zielone (zasady: [`../testing.md`](../testing.md)).
- `npm run verify` przechodzi.
- Interfejs po angielsku.
- Status w tej tabeli zaktualizowany.
