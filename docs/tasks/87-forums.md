# 87 – Fora autora i globalne

Subtask 68, zależy od 77 i 80. Podstawa: D80 (Fora i panel admina – fora i kategorie; Interakcje z tekstem – edycja, długości, antyspam). Branch `feature/87-forums` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcje `forumCategories` (`_id` klucz, `labels: { en, pl }`, `scope: global`, `adminOnly?`, `order`, `moderatorIds`), `forumThreads` (`scope: global | author`, `categoryId?` (global), `authorId?` (forum autora), `userId`, `title` (`MAX_THREAD_TITLE_LENGTH`), `createdAt`, `lastPostAt`, `postCount`, `hidden?`, `deletedAt?`), `forumPosts` (`threadId`, `userId`, `body` (`MAX_POST_LENGTH`), `quotePostId?`, `createdAt`, `editedAt?`, `hidden?`, `purgeAt?`), `threadFollows` (`userId`, `threadId`, unikalny).
- Migracja `008-forum-categories` (`$setOnInsert`, jak D79): Ogłoszenia (`adminOnly`), Warsztat pisarski, Pomysły i feedback do aplikacji, Polecenia lektur, Hyde Park, etykiety en/pl. Zarządzanie kategoriami w panelu admina (88).
- Forum autora: `/p/<nick>/forum` (lista wątków) i wątki; moderuje autor i jego moderatorzy (79: `hideContent` obejmuje posty i wątki). Fora globalne: `/forums`, `/forums/<kategoria>`, `/forums/t/<id>`; moderują admini i moderatorzy kategorii.
- Akcje: `createThread` (10/dobę), `createPost` (5/min, 100/dobę), `editPost` (15 min), `deletePost`, `quotePost` (cytat w treści + `quotePostId`), `followThread`/`unfollowThread`; `canInteract(kind: "forumPost")` (ban w społeczności dla forum autora, ban globalny, blokada z autorem forum i z autorem cytowanego posta). Pierwszy post wątku = treść wątku.
- Reakcje na postach przez mechanizm 77 (`targetType: post`). Zgłoszenia (80): forum autora → autor, globalne → admin.
- Powiadomienia (81): odpowiedź w obserwowanym wątku, cytat mojego posta; wzmianki (82). `recordActivity(forumThread)` dla wątku autora w swoim forum (75).
- Gość czyta, strony indeksowane. Pozycja „Fora” w sidebarze włączona.

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
- E2E: `tests/e2e/forums.spec.ts` (`dave` zakłada wątek w Warsztacie, `erin` cytuje, `dave` dostaje powiadomienie; forum autora `alice`; gość).
