# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions.md`](../decisions.md) (ma pierwszeństwo). Wersja 1.0 (tag `v1.0.0`) jest na produkcji; taski dotyczą zmian po 1.0. Szczegóły tasku w `NN-<slug>.md` (sekcje Zakres, Kryteria akceptacji, Testy). Zakończone taski usuwamy z tabeli i z katalogu (zostają w historii gita); numeracja rośnie dalej, żeby nie powtarzać nazw branchy.

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione (zmergowane do `develop`).

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 12 | [Pozycja przewijania przy przełączaniu widoków](12-keep-scroll-position.md) | – | [ ] |
| 13 | [Myślniki dialogowe zamiast listy](13-dialogue-dashes.md) | – | [ ] |
| 14 | [Mniejszy górny pasek](14-compact-header.md) | – | [ ] |
| 15 | [Przewijanie poza początek i koniec tekstu](15-scroll-past-edges.md) | 12 | [ ] |
| 16 | [Lokalny backup bazy](16-local-backup.md) | – | [ ] |

## Backlog

Pomysły bez pliku taska – do obgadania, zanim staną się taskami.

- Generatory różnego rodzaju (szczegóły do ustalenia).
- System społecznościowy (do przemyślenia).
- Tagowanie opowiadań i wyszukiwanie wśród publicznych opowiadań.
- Słowniki różnego rodzaju, np: synonimów, rymów, sjp
- Upload okładki / obrazka do opowiadania.
- Pełne sprawdzanie tekstu niezależne od ustawień przeglądarki (do przemyślenia). Dziś pisownię sprawdza przeglądarka i tylko z włączonym polskim słownikiem (D21). Docelowo:
  - pisownia, gramatyka, stylistyka i interpunkcja;
  - opcjonalnie zaznaczanie powtórzeń, z możliwością włączenia w ustawieniach użytkownika.

  Możliwości: LanguageTool (publiczne API, Premium, własny serwer), LLM, Hunspell w aplikacji. Każda wymaga albo wysłania tekstu poza przeglądarkę, albo płatnego hostingu, albo nowych pakietów (D21).

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
