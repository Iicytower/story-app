# 07 – Wyrównanie i kolor tekstu

Zależy od 06. Nowe pakiety: `rehype-raw`, `rehype-sanitize` (zgoda użytkownika). Zmienia zasadę „nigdy `rehype-raw`” w `CLAUDE.md` i D8.

## Zakres

- Przyciski w pasku edytora (treść i notatki):
  - wyrównanie: do lewej, do środka, do prawej, wyjustowanie;
  - kolor tekstu z palety 6–8 nazwanych kolorów, plus „Default”.
- Zapis w źródle jako ograniczony HTML **wyłącznie z klasami z listy**, bez atrybutu `style`:
  - wyrównanie: `<p class="align-center">…</p>` (także `align-right`, `align-justify`; do lewej = brak znacznika);
  - kolor: `<span class="color-red">…</span>`.

  Markdown wewnątrz zostaje.
- Renderowanie wszędzie (edytor, strona publiczna, udostępniony folder): `rehype-raw` + `rehype-sanitize` ze schematem dopuszczającym tylko:
  - elementy markdowna;
  - `p` i `span`, z atrybutem `className`, który przyjmuje wyłącznie wartości z listy.

  Wszystko inne jest usuwane: inne tagi, `style`, `on*`, `id`, nieznane klasy, `javascript:` w linkach. Komentarze nadal usuwa `stripComments` na serwerze i sanitize (bez `allowComments`).
- Kolory palety jako tokeny CSS z wariantem dla jasnego i ciemnego motywu.
- Eksport `.md` i `.zip` zawiera HTML bez zmian.
- Decyzja w `decisions.md` (zastępuje część D8) i zmiana zasady w `CLAUDE.md`.

## Kryteria akceptacji

1. Każdy przycisk wyrównania i koloru daje oczekiwany HTML w Source i właściwy wygląd w Preview i na stronie publicznej.
2. Kolory czytelne w obu motywach (`manual`: zrzut obu motywów).
3. Sanitizer usuwa: `<script>`, `<img onerror>`, `<a href="javascript:">`, `<span style="…">`, `<span class="nieznana">`, `<iframe>`, `<svg>`, `<style>`, `<p class="align-center" onclick>` (zostaje sama klasa) oraz wariant zagnieżdżony i z wielką literą w nazwie tagu.
4. Komentarze dalej nie trafiają na stronę publiczną (istniejące testy zielone).
5. Edytor zachowuje znaczniki przy Source ↔ Preview i po zapisie.

## Testy

- Jednostkowe: schemat sanitize na liście payloadów XSS (3), renderowanie klas (1).
- E2E: przyciski → Source i Preview (1, 5), strona publiczna z formatowaniem (1, 4).
- `manual`: kryterium 2.
