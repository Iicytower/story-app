# 79 – Moderacja autora

Subtask 68, zależy od 76. Podstawa: D80 (Role, bany, blokady – moderatorzy autora, ban w społeczności, moderacja treści). Branch `feature/79-author-moderation` z `feature/social`, merge do `feature/social`.

## Zakres

- Ukrywanie: akcje `hideContent(targetType, id, reason?)` i `restoreContent` dla komentarzy (posty forum autora w 87). Uprawniony: autor społeczności i jego aktywni moderatorzy; moderator nie ukrywa treści autora ani innych moderatorów. Ukryte: „ukryte przez moderatora”, odpowiedzi zostają, `purgeAt` = 30 dni (TTL).
- Bany: `banFromCommunity(nick, duration: 1 | 7 | 30 | null, reason)` (powód obowiązkowy, `MAX_BAN_REASON_LENGTH`), `liftCommunityBan`. Zbanowany widzi baner z powodem i terminem w społeczności autora.
- Moderatorzy: `inviteModerator(nick)` (najwyżej 10 aktywnych + zaproszonych), `acceptModeratorInvite`, `declineModeratorInvite`, `resignModerator`, `removeModerator`. Akceptacja z powiadomienia (81) albo z panelu (do czasu 81 z panelu).
- Kolekcja `moderationLog` (`authorId` | `scope: global`, `actorId`, `action`, `targetType`, `targetId`, `targetUserId?`, `reason?`, `createdAt`), wpis przy każdym działaniu.
- Panel `/moderation` (autor z publikacjami lub moderator): społeczności, które moderuję; zakładki: treści ukryte, bany, moderatorzy (tylko autor), log, zgłoszenia (80). Pozycja „Moderacja” w sidebarze włączona warunkowo.
- Akcje moderatora w menu ⋮ przy komentarzu (ukryj, zbanuj autora).

## Kryteria akceptacji

1. Autor i moderator ukrywają i przywracają cudzy komentarz w społeczności autora; poza nią → `NOT_FOUND`.
2. Moderator nie ukrywa i nie banuje autora ani innego moderatora.
3. Ban wymaga powodu, działa do terminu (po nim wygasa sam), zdjęcie działa od razu; zbanowany widzi powód.
4. Zaproszenie wymaga akceptacji; limit 10; rezygnacja i odebranie roli działają.
5. Każde działanie ma wpis w logu widoczny dla autora.
6. Ukryty komentarz znika po 30 dniach (indeks TTL na `purgeAt`).

## Testy

- Integracyjne: `tests/integration/author-moderation.test.ts` (1–5, 6 przez definicję indeksu TTL w `syncIndexes()`).
- E2E: `tests/e2e/moderation.spec.ts` (`alice` zaprasza `erin`, `erin` akceptuje i ukrywa komentarz `dave`, `alice` banuje `dave` z powodem, `dave` widzi baner).
