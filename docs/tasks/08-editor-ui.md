# 08 – Edytor: UI, podgląd, notatki, liczniki

Spec: „Edytor”.

## Zakres

- `/stories/[id]`: Server Component ładuje opowiadanie (404 dla usuniętych/nieistniejących/cudzych), przekazuje zserializowane dane do komponentu klienckiego.
- Pole tytułu, `textarea` po lewej, podgląd na żywo po prawej.
- Podgląd: `react-markdown` + `remark-breaks`, bez `rehype-raw` (komentarze HTML ukryte, ochrona XSS).
- Zwijany panel boczny z notatkami.
- Licznik słów i znaków (treść).
- Przycisk „Delete” z potwierdzeniem → `deleteStory` → przejście do `/stories`.
- Miejsca na przyciski „Export .md”, „Share/Stop sharing” i wskaźnik stanu zapisu (logika w 09–11).

## Kryteria akceptacji

- `<!-- komentarz -->` widoczny w textarea, niewidoczny w podglądzie.
- Pojedynczy Enter = złamanie linii w podglądzie.
