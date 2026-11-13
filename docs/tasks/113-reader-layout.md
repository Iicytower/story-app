# 113 – Czytelnik: szerokość, krój, mobile

Model: sonnet

Subtask 108. Podstawa: [D85](../decisions/D085-poprawa-ux-ui-2.md), raport (B3, B11, A7). Branch `feature/113-reader-layout` z `fix/ui-2`, merge do `fix/ui-2`.

## Zakres

- `components/markdown-preview.tsx` (`max-w-none` → ok. 65 znaków, `leading-relaxed`) i `PageContainer` na stronie rozdziału: linia 50–75 znaków. Krój szeryfowy (zmienna w `globals.css`) tylko dla prozy czytelnika (nie edytora i nie podglądu w edytorze, D99).
- Mobile czytelnika: gwiazdki oceny, „Odpowiedz”, „Zgłoś rozdział”, „Skomentuj”, „Zakładka” – cele min. 36–44 px; pasek zakładek `reader-marks.tsx` z `env(safe-area-inset-bottom)`; „Zakładka”, „Zakładki i notatki”, „Spis treści” nie wyglądają na wyłączone (kontrast co najmniej AA).
- Zmiana nie dotyczy podglądu w edytorze ani notatek.

## Kryteria akceptacji

1. Linia tekstu w czytelniku ma 50–75 znaków przy szerokości 1280 px.
2. Proza w czytelniku jest szeryfowa, edytor i UI zostają w Geist.
3. Wymienione kontrolki mają min. 36 px na 375 px.
4. Drugorzędne przyciski mają kontrast co najmniej AA w obu motywach.

## Testy

- E2E: szerokość kolumny `.prose` w pikselach (1), `getComputedStyle(font-family)` (2), `boundingBox` na 375 (3); (4) `manual` (`ui-checker`).
