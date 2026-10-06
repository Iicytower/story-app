# 11 – Udostępnianie przez link

Spec: „Udostępnianie przez link”.

## Zakres

- Server Action `setSharing(id, enabled)` (tylko własne opowiadania): włączenie generuje `shareToken` (`nanoid`, ≥16 znaków), wyłączenie usuwa pole; zwraca link lub potwierdzenie.
- Przyciski „Share” / „Stop sharing” w edytorze, wyświetlenie linku `/s/[token]` (z możliwością skopiowania).
- `stripComments`: usuwa `<!-- -->` w pętli do stabilizacji; jeśli zostaje `<!--`, obcina resztę.
- Testy `stripComments`: wielolinijkowy, niedomknięty, zagnieżdżony, sklejony.
- Strona `/s/[token]` (SSR, publiczna): zapytanie z projekcją tylko `title` i `content`, filtr `deletedAt: null`; 404 gdy brak.
- `noindex`: meta tag + nagłówek `X-Robots-Tag`.

## Kryteria akceptacji

- Po „Stop sharing” lub soft delete link zwraca 404.
- Źródło HTML strony publicznej nie zawiera komentarzy ani notatek.
