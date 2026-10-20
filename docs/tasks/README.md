# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Wersja 1.0 (tag `v1.0.0`) jest na produkcji; taski dotyczą zmian po 1.0. Szczegóły tasku w `NN-<slug>.md` (sekcje Zakres, Kryteria akceptacji, Testy).

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione (zmergowane do `develop`).

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |

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
