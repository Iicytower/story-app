# 85 – Wiadomości prywatne

Subtask 68, zależy od 81. Podstawa: D80 (Powiadomienia, DM, realtime – DM i polling; Role, bany, blokady – blokada). Branch `feature/85-direct-messages` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcje `conversations` (`participantIds` [2, posortowane], `lastMessageAt`, `lastReadAt: { <userId>: Date }`, `closedAt?` (blokada); pole `pairKey: "<mniejszyId>:<większyId>"` z unikalnym indeksem, a `participantIds` ze zwykłym indeksem `{ participantIds: 1, lastMessageAt: -1 }` do listy rozmów) i `messages` (`conversationId`, `senderId`, `body` (`MAX_DM_LENGTH`), `createdAt`; indeks `{ conversationId, createdAt }`). Bezterminowo.
- Akcje: `startConversation(nick, body)` (ustawienie odbiorcy `dmFrom: everyone | following | nobody` w `settings`; `following` = osoby obserwowane przez odbiorcę; limit 10 nowych rozmów/dobę), `sendMessage(conversationId, body)` (30/min), `markConversationRead`. `sendMessage` i `startConversation` wołają `notifyMentions` z 82 (wzmianka tylko drugiej strony rozmowy). `canInteract(kind: "dm")`: ban globalny, blokada → odmowa. Tylko uczestnik widzi rozmowę (inne → `NOT_FOUND`).
- Strony `/messages` (lista rozmów z nieprzeczytanymi) i `/messages/<id>` (wątek, `SocialMarkdown`, stronicowanie wstecz po 50). Przycisk „Wiadomość” na profilu. Licznik nieprzeczytanych w sidebarze z akcji `unreadCounts` (81). Polling otwartej rozmowy co 5 s przy widocznej karcie.
- Ustawienie „Kto może zacząć rozmowę” w dialogu ustawień. Pozycja „Wiadomości” w sidebarze włączona.
- Powiadomienia (81): `unreadCounts.messages` zwraca dziś 0 – podpiąć liczbę nieprzeczytanych rozmów; rodzaje DM w grupie `conversations`.

## Kryteria akceptacji

1. Dwie osoby wymieniają wiadomości; trzecia nie widzi rozmowy.
2. `dmFrom` blokuje nowe rozmowy wg ustawienia; istniejące działają dalej.
3. Ban globalny i blokada odrzucają wysyłkę; blokada zamyka rozmowę w obie strony.
4. Limity długości, nowych rozmów i wiadomości (połowa dla nowego konta).
5. Licznik nieprzeczytanych i oznaczanie przeczytanych.
6. Otwarta rozmowa odświeża się co 5 s przy widocznej karcie.
7. Gość klikający „Wiadomość” dostaje dialog logowania (D42).

## Testy

- Integracyjne: `tests/integration/direct-messages.test.ts` (1–5, wzmianka drugiej strony daje powiadomienie).
- E2E: `tests/e2e/direct-messages.spec.ts` (7 – gość i dialog logowania; `dave` pisze do `erin` w dwóch kontekstach, odpowiedź widoczna po pollingu z `page.clock` – 6; `erin` ustawia `nobody`).
