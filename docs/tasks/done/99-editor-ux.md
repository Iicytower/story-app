# 99 – Edytor: odstęp, układ mobile, paski, nazwy trybów

Subtask 51. Podstawa: [D83](../../decisions/D083-poprawa-ux-ui.md) i raport `docs/ui-ux-report.md` (usunięty 2026-11-13, dostępny w historii gita) (numery punktów w nawiasach). Branch `feature/99-editor-ux` z `fix/ui`, merge do `fix/ui`.

## Zakres

- `components/markdown-editor.tsx`: `TOP_GAP` zastąpiony stałym odstępem dwóch wysokości linii (treść i notatki) (4.1, 3.7; D30 zmieniona w D83). Dolny odstęp bez zmian. Zachowanie pozycji przewijania (D27) i przełączania trybów dostosowane.
- `stories/[id]/layout-store.ts` (po 93 `chapters/[id]`): bez układu desktopowego przed hydratacją na wąskim ekranie – przełączanie w CSS (`md:`) albo oba warianty ukryte do hydratacji (4.2).
- Pasek narzędzi notatek rozdziału i książki widoczny tylko, gdy pole ma fokus (także przy otwartym wyszukiwaniu w polu); pasek treści bez zmian (4.3).
- Tryby: „Tekst” / „Markdown” (en: „Text” / „Markdown”) zamiast „Podgląd” / „Źródło” (4.4).
- Sidebar aplikacji zwinięty domyślnie na stronie edytora; ręczne rozwinięcie zapamiętane tak jak dotychczasowy stan sidebara (4.5).
- Stały status „Zapisano” w stopce obok licznika słów (stany: zapisywanie, zapisano, błąd), bez animacji (4.6).
- Panel Narzędzia: margines kart od prawej krawędzi (4.7).

## Kryteria akceptacji

1. Po otwarciu rozdziału pierwsza linia tekstu jest najwyżej dwie linie pod górną krawędzią pola (desktop i 375 px); notatki tak samo.
2. Na 375 px pierwszy render (przed hydratacją, JS wyłączony lub zrzut przed `load`) nie pokazuje panelu bocznego desktopu.
3. Bez fokusu w notatkach nie widać ich pasków narzędzi; po kliknięciu w pole pasek się pojawia.
4. Przełącznik trybów pokazuje „Tekst” / „Markdown”.
5. Edytor startuje ze zwiniętym sidebarem aplikacji, rozwinięcie jest zapamiętane.
6. Status zapisu jest stale widoczny w stopce.

## Testy

- E2E: `scroll-past-edges.spec.ts` i `scroll-position.spec.ts` zaktualizowane (1), `editor-mobile.spec.ts` (2 – `javaScriptEnabled: false` albo zrzut DOM z odpowiedzi serwera), `editor-panels.spec.ts` (3, 5), `wysiwyg.spec.ts` (4), `save.spec.ts` (6).
