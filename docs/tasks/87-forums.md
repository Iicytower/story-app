# 87 – Fora autora i globalne

Subtask 68, zależy od 75, 77, 80, 81, 82 i 86. Podstawa: D80 (Fora i panel admina – fora i kategorie; Interakcje z tekstem – edycja, długości, antyspam). Branch `feature/87-forums` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcje `forumCategories` (`_id` klucz, `labels: { en, pl }`, `scope: global`, `adminOnly?`, `order`, `moderatorIds`), `forumThreads` (`scope: global | author`, `categoryId?` (global), `authorId?` (forum autora), `userId`, `title` (`MAX_THREAD_TITLE_LENGTH`), `createdAt`, `lastPostAt`, `postCount`, `hidden?`, `purgeAt?` (TTL), `deletedAt?`; posty wątku usuniętego przez TTL sprzątane leniwie przy odczycie forum), `forumPosts` (`threadId`, `userId`, `body` (`MAX_POST_LENGTH`), `quotePostId?`, `createdAt`, `editedAt?`, `hidden?`, `purgeAt?`), `threadFollows` (`userId`, `threadId`, unikalny).
- Migracja `008-forum-categories` (albo kolejny wolny numer, jeśli wcześniejszy task zajął 008; wtedy popraw też nazwy niżej) (`$setOnInsert`, jak D79): Ogłoszenia (`adminOnly`), Warsztat pisarski, Pomysły i feedback do aplikacji, Polecenia lektur, Hyde Park, etykiety en/pl. Zarządzanie kategoriami w panelu admina (88).
- Forum autora: `/p/<nick>/forum` (lista wątków) i wątki (`forum` jest już na liście zarezerwowanych slugów folderów z 71; test w `lib/publish/slugs.test.ts`); moderuje autor i jego moderatorzy (79: `hideContent` obejmuje posty i wątki). Forum autora istnieje dla każdego konta z nickiem, które ma co najmniej jedną publiczną książkę; inaczej `/p/<nick>/forum` → 404. Fora globalne: `/forums`, `/forums/<kategoria>`, `/forums/t/<id>`; moderują admini i moderatorzy kategorii.
- Akcje: `createThread` (10/dobę), `createPost` (5/min, 100/dobę), `editPost` (15 min), `deletePost`, `quotePost` (cytat w treści + `quotePostId`), `followThread`/`unfollowThread`; `canInteract(kind: "forumPost")` (ban w społeczności dla forum autora, ban globalny, blokada z autorem forum i z autorem cytowanego posta). Pierwszy post wątku = treść wątku.
- Reakcje na postach przez mechanizm 77 (`targetType: post`). Zgłoszenia (80): forum autora → autor, globalne → admin; typ `post` w `reports` dopisany tutaj z testem w `forums.test.ts`.
- Reakcje (77): `react` z `targetType "post"` zwraca dziś `INVALID_INPUT` – dopisać kontrolę widoczności posta i `canInteract` wobec piszącego; dla posta `folderId` i `storyId` `null`, `authorId` = autor forum, `null` dla forum globalnego.
- Powiadomienia (81): odpowiedź w obserwowanym wątku, cytat mojego posta; wzmianki (82). `recordActivity(forumThread)` dla wątku autora w swoim forum (75). Feed czyta dziś tylko `chapterPublished`: typ `forumThread` dopisać do zapytania i filtrów widoczności w `lib/social/feed.ts` oraz do renderowania na stronie `/feed`.
- Gość czyta, strony indeksowane. Pozycja „Fora” w sidebarze włączona.
- Moderacja (79): ukrywanie postów forum przez `hideContent` (dziś tylko komentarze); zbanowany w społeczności autora bez pisania i z zablokowanymi reakcjami – `isBannedAt` z `lib/social/moderation.ts` i prop `locked`.
- Zgłoszenia (80): `targetType: "post"` jest w `REPORT_TARGETS`, ale `report` (`app/[locale]/p/[nickname]/report-actions.ts`) go dziś wyklucza – dopisać widoczność posta i trasę (`author` z `authorId` dla forum autora, `admin` dla globalnych) z testem.
- Powiadomienia (81): obserwowany wątek do wielu odbiorców partiami po 500 (`bulkWrite` w `after()`, jak nowe rozdziały); nowe rodzaje dopisać do ustawień powiadomień.
- Wzmianki (82): posty jak komentarze (`notifyLater` z type `mention`); własny klucz tekstu powiadomienia (dziś „w komentarzu”); pole posta jako `MentionTextarea`; `resolveMentions` przy odczycie listy postów.

## Kryteria akceptacji

1. Migracja zasiewa 5 kategorii i nie nadpisuje zmian przy ponownym uruchomieniu.
2. Zalogowany zakłada wątek i pisze posty z cytowaniem w forum globalnym i autora; w „Ogłoszeniach” piszą tylko admini.
3. Edycja 15 min, limity długości i antyspamu.
4. Ban w społeczności blokuje forum autora, ban globalny wszystkie fora, blokada – odpowiedź i cytat wobec blokującego.
5. Moderatorzy właściwego zakresu ukrywają posty i wątki; spoza zakresu → `NOT_FOUND`.
6. Obserwowany wątek daje powiadomienie o nowym poście; cytat daje powiadomienie cytowanemu.
7. Gość czyta fora; blokujący nie widzi postów zablokowanego.

## Testy

- Integracyjne: `tests/integration/migration-008.test.ts` (1), `tests/integration/forums.test.ts` (2–7; macierz blokady z 86 rozszerzona o posty).
- E2E: `tests/e2e/global-setup.ts` woła `up` z `migrations/008-forum-categories` jak dziś `007`; `tests/e2e/forums.spec.ts` (`dave` zakłada wątek w Warsztacie, `erin` cytuje, `dave` dostaje powiadomienie; forum autora `alice`; gość).
