# 75 – Feed aktywności

Subtask 68, zależy od 71 i 72. Podstawa: D80 (Profil, relacje, biblioteka – feed). Branch `feature/75-feed` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `activity` (`actorId`, `type: chapterPublished | forumThread | authorReply`, `folderId?`, `storyId?`, `threadId?`, `commentId?`, `createdAt`, TTL 90 dni; indeks `{ actorId, createdAt: -1 }`). Funkcja `recordActivity` wołana w publikacji rozdziału (tylko pierwsza publikacja) teraz, a w 76 i 87 dla odpowiedzi autora i wątków.
- `stampPublishedAt` (`lib/publish/mutations.ts`) najpierw robi `find` id rozdziałów z filtrem `publishedAt: { $exists: false }`, potem `updateMany` po tych id i zwraca je; `recordActivity` i powiadomienia „nowy rozdział” (81) dostają tę listę. Publikacja folderu daje jedno zdarzenie i jedno powiadomienie na książkę (z liczbą rozdziałów), nie na rozdział.
- Strona `/feed` (zalogowany): zdarzenia obserwowanych autorów od najnowszych, stronicowanie kursorem po 30. Przy odczycie odfiltrowane obiekty niepubliczne (D38), autorzy z banem globalnym i zablokowani w obie strony. 18+ ze znaczkiem (D67, D69).
- Pusty feed: zachęta z linkiem do strony głównej. Pozycja „Feed” w sidebarze włączona.

## Kryteria akceptacji

1. Publikacja rozdziału przez obserwowanego autora pojawia się w feedzie obserwującego, a nie u innych.
2. Ukrycie lub usunięcie rozdziału usuwa zdarzenie z feedu (przy odczycie), ponowna publikacja go nie duplikuje.
3. Zablokowani i zbanowani globalnie autorzy nie pojawiają się w feedzie.
4. Stronicowanie zwraca kolejne zdarzenia bez powtórzeń.

## Testy

- Integracyjne: `tests/integration/feed.test.ts` (1–4).
- E2E: `tests/e2e/feed.spec.ts` (`dave` obserwuje `alice`, `alice` publikuje, `dave` widzi wpis; `erin` nie).
