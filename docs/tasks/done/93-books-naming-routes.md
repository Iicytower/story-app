# 93 – Nazewnictwo „Książka/Rozdział” i nowe adresy

Subtask 51. Podstawa: [D83](../decisions/D083-poprawa-ux-ui.md) i raport `docs/ui-ux-report.md` (usunięty 2026-11-13, dostępny w historii gita) (numery punktów w nawiasach). Branch `feature/93-books-naming-routes` z `fix/ui`, merge do `fix/ui`.

## Zakres

- Wszystkie wartości w `messages/en.json` i `messages/pl.json`: kontener „Książka”/„Book”, element „Rozdział”/„Chapter” (Książki, Nowa książka, Nowy rozdział, Wszystkie książki, „Możesz mieć najwyżej … książek” itd.), tytuły stron i `metadata` (np. „Opowiadania – Story App” → „Książki – Story App”), strony publiczne, feed, profil, statystyki, powiadomienia (3.1). Klucze bez zmian. Odmiana w ICU (`plural`) poprawiona po polsku.
- Trasy: `app/[locale]/(protected)/stories` → `books` (lista), `folders/[id]` → `books/[id]`, `stories/[id]` → `chapters/[id]` (edytor); Route Handlery `app/folders/[id]/export…` → `app/books/[id]/export…`, `app/stories/[id]/export…` → `app/chapters/[id]/export…`. Bez przekierowań, stare adresy 404.
- `proxy.ts`: wyjątek dla Route Handlerów eksportu poza `[locale]` (dziś `(stories|folders)/[^/]+/export`) zmieniony na `(chapters|books)`, inaczej eksport przekierowuje na `/en/books/...`.
- Wszystkie linki, `redirect`, `revalidatePath`, `getPathname`, linki w powiadomieniach, middleware/proxy (chronione ścieżki), sitemap/robots jeśli są, `docs/` i `README.md` w miejscach opisujących adresy.
- Modele, kolekcje, nazwy w kodzie i klucze `messages` bez zmian.

## Kryteria akceptacji

1. Żaden tekst UI w `pl` ani `en` nie używa „folder”/„opowiadanie” w znaczeniu kontenera (wyjątek: placeholder wyszukiwarki „Szukaj opowiadań” z D83).
2. `/books`, `/books/[id]`, `/chapters/[id]` i eksport pod nowymi adresami działają; `/stories`, `/folders/[id]`, `/stories/[id]` dają 404.
3. Wszystkie linki w aplikacji (sidebar, menu, powiadomienia, edytor, eksport) prowadzą pod nowe adresy.
4. Izolacja użytkowników bez zmian: cudza książka/rozdział pod nowym adresem = 404.

## Testy

- Unit: test słowników (`messages`) – brak „folder”/„Folder”/„opowiadani” w wartościach poza wyjątkiem z kryterium 1.
- Integracyjne: istniejące testy eksportu pod nowymi ścieżkami (4).
- Przed zamknięciem pełny `npm run verify` (task zmienia adresy i teksty w całej aplikacji), nie tylko specy powiązane.
- E2E: wszystkie specy, `helpers.ts` i `env.ts` zaktualizowane do nowych adresów i tekstów w tym tasku; nowy `tests/e2e/routes.spec.ts` (2, 3 – stare adresy 404, link z sidebara i z powiadomienia).
