# 86 – Blokowanie w pełnym zakresie

Subtask 68, zależy od 82, 84 i 85. Podstawa: D80 (Role, bany, blokady – blokada). Branch `feature/86-blocking` z `feature/social`, merge do `feature/social`.

## Zakres

- Akcje `blockUser(nick)` / `unblockUser(nick)` (nie siebie; limit `SOCIAL_LIMITS.block`, 60/min). Bez transakcji Mongo (standalone w testach): najpierw `insert` do `blocks` (od tej chwili `canInteract` odmawia), potem idempotentne `deleteMany` w `follows` (obie strony, 71) i `closedAt` rozmowy (85); ponowne `blockUser` dokańcza przerwane kroki. Blokada daje zablokowanemu ban w społeczności blokującego bez terminu (efekt przez `canInteract`, bez dokumentu w `communityBans`, więc odblokowanie go zdejmuje).
- „Zablokuj” na profilu i w menu ⋮ komentarza; lista zablokowanych z odblokowaniem w dialogu ustawień. Odblokowanie zdejmuje `closedAt` rozmowy, jeśli żadna strona nie blokuje drugiej.
- Ukryć przycisk Obserwuj przy blokadzie (71; dziś przycisk widoczny, odmawia akcja).
- Przegląd wszystkich miejsc odczytu: komentarze, reakcje (lista nicków), feed, powiadomienia, podpowiedzi nicków, rankingi, listy obserwujących – zablokowani przez widza ukryci (`hiddenUserIdsFor`). Publiczna wyszukiwarka (39) dalej pokazuje teksty autorów zablokowanych przez widza: D80 pozwala B czytać A, a A nie musi ich ukrywać. Publiczne teksty blokującego dalej czytelne dla zablokowanego.
- Test macierzowy: każda interakcja z D80 (komentarz, odpowiedź, reakcja, ocena, wzmianka, DM, obserwowanie, post forum – gdy 87 gotowe, dopisany tam) w obu kierunkach blokady.
- Komentarze (76): odpowiedzi sprawdzane przez `canInteract(kind: "reply")` wobec autora rodzica i korzenia wątku (poza `COMMUNITY_KINDS`) – uwzględnić w teście macierzowym.
- Moderacja (79): blokada moderatora przez autora (i odwrotnie) dziś nie odbiera roli – rozstrzygnąć tutaj; blokada w dowolną stronę już uniemożliwia zaproszenie i przyjęcie. Ban globalny: `moderationLog.scope: global` (dziś wpisy tylko społeczności).
- Powiadomienia (81): moderacja ignoruje blokady w powiadomieniach, więc blokada między autorem a moderatorem musi kończyć relację `CommunityModerator`.
- Rankingi (84): blokady filtrowane przy odczycie w obie strony przez `feedHiddenUserIds` (jak feed 75) – sprawdzić spójność z pełną blokadą.
- DM (85): przy blokadzie i odblokowaniu wołać `setConversationClosed(a, b, closed)` z `lib/social/direct-messages.ts`; przycisk Zablokuj na profilu w miejscu komentarza `Block (86) goes here.` w `app/[locale]/p/[nickname]/page.tsx`.

## Kryteria akceptacji

1. Zablokowany nie pisze DM, nie odpowiada na komentarze blokującego, nie wspomina go, nie obserwuje go i nie komentuje, nie reaguje ani nie ocenia u niego (jako autora).
2. Blokujący nie widzi komentarzy i postów zablokowanego nigdzie.
3. Zablokowany nadal czyta publiczne teksty blokującego.
4. Blokada usuwa obserwacje w obie strony i zamyka rozmowę; odblokowanie przywraca możliwość interakcji (bez przywracania obserwacji) i zdejmuje `closedAt` rozmowy, jeśli żadna strona nie blokuje drugiej.
5. Lista zablokowanych w ustawieniach z odblokowaniem.

## Testy

- Integracyjne: `tests/integration/blocking.test.ts` (1 jako macierz interakcji × kierunek, 2, 4).
- E2E: `tests/e2e/blocking.spec.ts` (`alice` blokuje `dave`: 2, 3, 5 i odmowa DM w UI).
