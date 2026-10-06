# 12 – Udostępnianie przez link

Spec: „Udostępnianie przez link”.

## Zakres

- Server Action `setSharing(id, enabled)` (tylko własne opowiadania): włączenie generuje `shareToken` (`nanoid`, ≥16 znaków), wyłączenie usuwa pole; zwraca link lub potwierdzenie.
- Przyciski „Share” / „Stop sharing” w edytorze, wyświetlenie linku `/s/[token]` (z możliwością skopiowania).
- `stripComments`: usuwa `<!-- -->` w pętli do stabilizacji; jeśli zostaje `<!--`, obcina resztę.
- Strona `/s/[token]` (SSR, publiczna): zapytanie z projekcją tylko `title` i `content`, filtr `deletedAt: null`; 404 gdy brak.
- `noindex`: meta tag + nagłówek `X-Robots-Tag`.

## Kryteria akceptacji

- Po „Stop sharing” lub soft delete link zwraca 404.
- Źródło HTML strony publicznej nie zawiera komentarzy ani notatek.

## Testy

- Jednostkowe `stripComments`: wielolinijkowy, niedomknięty, zagnieżdżony, sklejony (`<!-<!-- -->- x -->`), tekst bez komentarzy bez zmian.
- Integracyjne `setSharing`: włączenie → token ≥ 16 znaków; ponowne włączenie (ustalić: ten sam czy nowy token); wyłączenie usuwa pole; cudze / usunięte → `NOT_FOUND`.
- Integracyjne zapytania strony publicznej: projekcja bez `notes`, usunięte → brak wyniku.
- E2E `tests/e2e/share.spec.ts`: link działa w kontekście bez sesji; HTML odpowiedzi nie zawiera komentarza ani notatek; `meta robots noindex` i nagłówek `X-Robots-Tag`; po „Stop sharing” i po usunięciu → 404.
