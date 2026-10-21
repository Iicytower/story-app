# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Wersja 1.0 (tag `v1.0.0`) jest na produkcji; taski dotyczą zmian po 1.0. Szczegóły tasku w `NN-<slug>.md` (sekcje Zakres, Kryteria akceptacji, Testy).

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione (zmergowane do `develop`).

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 07 | [Wersjonowanie opowiadań](07-story-versioning.md) | – | [ ] |
| 08 | [Sprawdzanie pisowni, interpunkcji i gramatyki](08-spell-check.md) | – | [ ] |
| 09 | [Ustawienia użytkownika](09-user-settings.md) | – | [ ] |

## Backlog

Pomysły bez pliku taska – do obgadania, zanim staną się taskami.

- Generatory różnego rodzaju (szczegóły do ustalenia).
- System społecznościowy (do przemyślenia).
- Tagowanie opowiadań i wyszukiwanie wśród publicznych opowiadań.
- Słowniki różnego rodzaju, np: synonimów, rymów, sjp
- Upload okładki / obrazka do opowiadania.

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
