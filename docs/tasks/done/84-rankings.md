# 84 – Rankingi na stronie głównej

Subtask 68, zależy od 71 i 83. Podstawa: D80 (Statystyki i odkrywanie – strona główna). Branch `feature/84-rankings` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `rankings` (`_id`: `weekly | topRated | tag:<klucz>`, `items: { folderId, storyId?, score }[]` (30 pozycji; po filtrze widza pokazywane pierwsze 10), `computedAt`, `computing?`). Leniwe przeliczenie: odczyt starszego niż 1 h zleca przeliczenie w `after()`; atomowe przejęcie (`computing` z terminem) jak D68; do czasu nowego wyniku pokazywany stary.
- Popularne tygodnia: liczba różnych `reader` w `readEvents` z 7 dni per `folderId` (agregacja `$group`, indeks `{ day, folderId }` z 83). Najwyżej oceniane: średnia bayesowska książek z co najmniej 5 ocenami (stała `C` = średnia globalna, `m` = 5). Popularne w kategoriach: dla każdego predefiniowanego tagu (D79) obecnego w danych, top 5 z tygodnia. Od obserwowanych (zalogowany): ostatnio opublikowane rozdziały obserwowanych, liczone na żywo (mała lista).
- Przy odczycie filtr widoczności (D38), bana globalnego i blokad widza. 18+ ze znaczkiem i okładką jak D69.
- Oceny (78): średnie liczyć z tym samym filtrem banów globalnych co liczniki ocen (`hiddenUserIdsFor(null)`, jednakowo dla każdego widza); dziś `$nin` bez limitu przy każdym renderze – rozważyć `$lookup` lub cache.
- Statystyki (83): ranking tygodnia z `readEvents` po indeksie `{day, folderId}`; `reader` gościa to `clientHash` (HMAC z `lib/rate-limit`); przy rankingu stosować filtr banów globalnych jak w ocenach (`readEvents` liczą zbanowanych czytelników).
- Strona główna: sekcje pod „Recently published” (D54), każda do 10 pozycji, z okładką i autorem; puste sekcje ukryte. Bez zużycia `SEARCH_LIMIT`.

## Kryteria akceptacji

1. Ranking tygodnia i najwyżej oceniane liczone zgodnie z definicją (min. 5 ocen).
2. Wynik przeliczany najwyżej raz na godzinę, równoległe żądania nie liczą podwójnie.
3. Niepubliczne, zbanowane globalnie i zablokowane przez widza pozycje nie pojawiają się.
4. Zalogowany widzi sekcję „Od obserwowanych”, gość nie.
5. Pozycje 18+ mają znaczek zamiast okładki.

## Testy

- Unit: `lib/social/rankings.test.ts` (średnia bayesowska, próg).
- Integracyjne: `tests/integration/rankings.test.ts` (1–3).
- E2E: `tests/e2e/home.spec.ts` (4, 5, sekcje na stronie głównej z danymi z seeda).
