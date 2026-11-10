# 83 – Statystyki autora

Subtask 68, zależy od 71, 72, 73, 76, 77 i 78. Podstawa: D80 (Statystyki i odkrywanie – statystyki). Branch `feature/83-author-stats` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcje `readEvents` (`storyId`, `folderId`, `day` (UTC, `YYYY-MM-DD`), `reader` (`u:<userId>` albo `g:<HMAC IP>`, D40/D74), `expiresAt` TTL 30 dni; unikalny `{ storyId, day, reader }`, indeks `{ day, folderId }` dla rankingu 84) i `dailyStats` (`storyId`, `folderId`, `authorId`, `day`, `readers`, bez TTL; unikalny `{ storyId, day }`).
- Zapis odczytu przy renderze publicznej strony rozdziału w `after()`: wstawienie `readEvents`, a tylko przy sukcesie (nie `E11000`) `$inc` w `dailyStats` (upsert). Nagłówek IP i `userId` czytane przed `after()` i przekazywane do callbacku (`headers()` nie działa w callbacku). Zapis tylko przy pełnym renderze strony, nie przy prefetchu (`<Link prefetch={false}>` do stron rozdziałów albo sprawdzenie nagłówka `next-router-prefetch`). Bez zaufanego IP gość nie jest liczony (D74). Autor czytający swój tekst nie jest liczony.
- Strona `/stats` (autor z publikacjami): wykresy `recharts` (shadcn `chart`, motyw z `lib/theme.ts`) unikalnych czytelników w czasie (7/30/90/365 dni, z `dailyStats`), tabela per rozdział i książka: czytelnicy, reakcje, średnia i liczba ocen, komentarze, dodania do bibliotek; liczba obserwujących. Tylko własne dane (`authorId` z sesji). Pozycja „Statystyki” w sidebarze włączona warunkowo.
- Kolekcje taska dopisane do `purgeSocialData` (69); test: trwałe usunięcie rozdziału i folderu kasuje ich wpisy.
- Komentarze (76): liczba komentarzy z `comments` po indeksie `{authorId, createdAt: -1}` (`authorId` = właściciel tekstu).

## Kryteria akceptacji

1. Ten sam czytelnik w tej samej dobie liczony raz; inny dzień – ponownie.
2. Gość liczony po HMAC adresu, bez jawnego IP w bazie; bez zaufanego adresu nie liczony.
3. Autor nie nabija sobie odczytów.
4. `dailyStats` zostaje po wygaśnięciu `readEvents`.
5. `/stats` konta bez publikacji → 404; zapytania biorą `authorId` z sesji (dane `bob` nieobecne u `alice`).
6. Wykres i tabela zgodne z danymi testowymi.

## Testy

- Integracyjne: `tests/integration/read-stats.test.ts` (1–5; równoległe odczyty nie liczą podwójnie).
- E2E: `tests/e2e/stats.spec.ts` (`dave` i `erin` czytają rozdział `alice`, `alice` widzi 2 w tabeli, a `data-testid="stats-chart"` ma liczbę punktów w atrybucie `data-points` – 6).
