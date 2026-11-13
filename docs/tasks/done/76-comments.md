# 76 – Komentarze

Subtask 68, zależy od 69, 70 i 75. Podstawa: D80 (Interakcje z tekstem; Zakres i zasady ogólne – widoczność; Role, bany, blokady). Branch `feature/76-comments` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `comments` (`authorId` – właściciel tekstu, `userId` – piszący, `folderId`, `storyId | null` (null = wątek spisu książki), `parentId | null` (jeden poziom), `body`, `createdAt`, `editedAt?`, `deletedAt?`, `hidden?: { by, at, reason? }`, `purgeAt?` (TTL, 30 dni od ukrycia)). Indeksy `{ storyId, createdAt }`, `{ folderId, storyId, createdAt }`, `{ userId: 1 }` (89, filtry banów) i `{ authorId: 1, createdAt: -1 }` (83, moderacja). Komentarze najwyższego poziomu stronicowane kursorem po 50 (od najnowszych), odpowiedzi do 100 na komentarz.
- Akcje: `addComment`, `replyToComment` (odpowiedź na odpowiedź przypina się do rodzica), `editComment` (15 min od `createdAt`, potem `FORBIDDEN`), `deleteComment` (własny; z odpowiedziami → „komentarz usunięty”, bez → usunięty). Każda: `canInteract(kind: "comment")` wobec autora tekstu i, przy odpowiedzi, wobec autora komentarza-rodzica (blokada); limity `takeUserAttempt` (10/min, 200/dobę); `MAX_COMMENT_LENGTH`; obiekt musi być publiczny (D38), komentarze włączone.
- Wyłączanie komentarzy: `folders.commentsDisabled`, `stories.commentsDisabled` (akcje autora w menu ⋮, `timestamps: false` jak D38); istniejące komentarze przy wyłączeniu ukryte.
- UI: sekcja komentarzy pod publiczną stroną rozdziału i pod publicznym spisem książki (`SocialMarkdown`, `UserAvatar`, „edytowano”, daty względne), formularz textarea; gość widzi komentarze i przycisk logowania. Widz nie widzi komentarzy autorów, których zablokował (`hiddenUserIdsFor`), ani autorów z banem globalnym. Liczniki komentarzy na spisie.
- `recordActivity(authorReply)` przy odpowiedzi autora tekstu. Hak dla powiadomień (81), wzmianek (82) i moderacji (79). Feed (75) czyta dziś tylko `chapterPublished`: typ `authorReply` dopisać do zapytania i filtrów widoczności w `lib/social/feed.ts` oraz do renderowania na stronie `/feed`; zapis przez ogólne `recordActivity(event)` (`lib/social/activity.ts`).
- Kolekcje taska dopisane do `purgeSocialData` (69); test: trwałe usunięcie rozdziału i folderu kasuje ich wpisy.

## Kryteria akceptacji

1. Zalogowany dodaje komentarz i odpowiedź pod publicznym rozdziałem i pod spisem; gość czyta.
2. Edycja tylko własnego i tylko przez 15 min; usunięcie własnego z odpowiedziami zostawia „komentarz usunięty”.
3. Niepubliczny lub usunięty obiekt: komentarze niewidoczne i zapis → `NOT_FOUND`; ponowna publikacja przywraca.
4. Wyłączone komentarze odrzucają nowe i ukrywają istniejące.
5. Ban w społeczności, ban globalny i blokada (z autorem tekstu albo autorem rodzica) odrzucają zapis.
6. Widz nie widzi komentarzy zablokowanych przez siebie użytkowników.
7. Limit długości i antyspam (z połową dla nowego konta).

## Testy

- Integracyjne: `tests/integration/comments.test.ts` (1–7, każdy przypadek bana i blokady osobno, izolacja: edycja cudzego → `NOT_FOUND`).
- E2E: `tests/e2e/comments.spec.ts` (`dave` komentuje rozdział `alice`, `erin` odpowiada, `alice` wyłącza komentarze; gość czyta).
