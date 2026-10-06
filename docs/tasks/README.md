# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Taski realizujemy w kolejności numerów (zależności podane w każdym pliku).

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione.

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 01 | [Scaffold projektu](01-scaffold.md) | – | [ ] |
| 02 | [Połączenie z bazą i modele](02-db-models.md) | 01 | [ ] |
| 03 | [Skrypt seedujący konto](03-seed-account.md) | 02 | [ ] |
| 04 | [Logowanie i ochrona tras](04-auth.md) | 02, 03 | [ ] |
| 05 | [Layout, nagłówek, dark mode](05-layout-theme.md) | 04 | [ ] |
| 06 | [Lista opowiadań i wyszukiwanie](06-stories-list.md) | 05 | [ ] |
| 07 | [Tworzenie i usuwanie opowiadań](07-create-delete.md) | 06 | [ ] |
| 08 | [Edytor: UI, podgląd, notatki, liczniki](08-editor-ui.md) | 07 | [ ] |
| 09 | [Zapis: saveStory, autozapis, zabezpieczenia](09-save.md) | 08 | [ ] |
| 10 | [Eksport .md](10-export.md) | 09 | [ ] |
| 11 | [Udostępnianie przez link](11-sharing.md) | 09 | [ ] |
| 12 | [Wdrożenie: Vercel + Atlas](12-deploy.md) | 01–11 | [ ] |

## Definicja „zrobione” (każdy task)

- Kryteria akceptacji z pliku taska spełnione.
- `npm run lint`, `npm run typecheck` i `npm test` przechodzą.
- Interfejs po angielsku.
- Status w tej tabeli zaktualizowany.
