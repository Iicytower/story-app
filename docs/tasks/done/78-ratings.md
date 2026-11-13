# 78 – Oceny

Subtask 68, zależy od 69. Podstawa: D80 (Interakcje z tekstem – oceny). Branch `feature/78-ratings` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `ratings` (`userId`, `targetType: story | folder`, `targetId`, `authorId`, `value` 1–5, `updatedAt`; unikalny `{ userId, targetType, targetId }`, indeksy `{ targetType: 1, targetId: 1 }` i `{ authorId: 1 }` (83)).
- Akcje `rate(targetType, targetId, value)` i `removeRating`. `canInteract(kind: "rate")`, limit `SOCIAL_LIMITS.rate` (60/min), obiekt publiczny, autor nie ocenia swoich tekstów, `value` całkowite 1–5 (inaczej `INVALID_INPUT`).
- Odczyt: średnia i liczba (agregacja po `targetId`), bez listy oceniających dla nikogo (także autora). Własna ocena widoczna dla oceniającego.
- UI: gwiazdki pod rozdziałem i na publicznym spisie (ocena książki), średnia i liczba ocen; gość widzi średnią.
- Hak dla statystyk (83) i rankingów (84).
- Kolekcje taska dopisane do `purgeSocialData` (69); test: trwałe usunięcie rozdziału i folderu kasuje ich wpisy.

## Kryteria akceptacji

1. Jedna ocena na obiekt; zmiana nadpisuje, usunięcie zdejmuje.
2. Średnia i liczba poprawne; nikt nie widzi, kto ocenił.
3. Wartość spoza 1–5 lub niecałkowita → `INVALID_INPUT`; autor nie ocenia swojego.
4. Ban, ban globalny, blokada i niepubliczny obiekt odrzucają ocenę.
5. Gość klikający ocena dostaje dialog logowania (D42).

## Testy

- Integracyjne: `tests/integration/ratings.test.ts` (1–4; odpowiedź akcji i strony bez identyfikatorów oceniających).
- E2E: `tests/e2e/ratings.spec.ts` (5 – gość i dialog logowania; `dave` ocenia rozdział i książkę `alice`, średnia u gościa).
