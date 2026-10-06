# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Taski realizujemy w kolejności numerów (zależności podane w każdym pliku).

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione.

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 01 | [Scaffold projektu](01-scaffold.md) | – | [ ] |
| 02 | [Połączenie z bazą i modele](02-db-models.md) | 01 | [ ] |
| 03 | [Skrypt seedujący konto](03-seed-account.md) | 02 | [ ] |
| 04 | [Logowanie i ochrona tras](04-auth.md) | 02, 03 | [ ] |
| 05 | [Infrastruktura E2E (Playwright)](05-e2e-setup.md) | 04 | [ ] |
| 06 | [Layout, nagłówek, dark mode](06-layout-theme.md) | 05 | [ ] |
| 07 | [Lista opowiadań i wyszukiwanie](07-stories-list.md) | 06 | [ ] |
| 08 | [Tworzenie i usuwanie opowiadań](08-create-delete.md) | 07 | [ ] |
| 09 | [Edytor: UI, podgląd, notatki, liczniki](09-editor-ui.md) | 08 | [ ] |
| 10 | [Zapis: saveStory, autozapis, zabezpieczenia](10-save.md) | 09 | [ ] |
| 11 | [Eksport .md](11-export.md) | 10 | [ ] |
| 12 | [Udostępnianie przez link](12-sharing.md) | 10 | [ ] |
| 13 | [Wdrożenie: Vercel + Atlas](13-deploy.md) | 01–12 | [ ] |

## Definicja „zrobione” (każdy task)

- Kryteria akceptacji z pliku taska spełnione, a testy z sekcji „Testy” napisane i zielone (zasady: [`../testing.md`](../testing.md)).
- `npm run verify` przechodzi (przed taskiem 05: `lint`, `typecheck`, `test`).
- Interfejs po angielsku.
- Status w tej tabeli zaktualizowany.
