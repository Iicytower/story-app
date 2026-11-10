# 86 – Blokowanie w pełnym zakresie

Subtask 68, zależy od 85 i 82. Podstawa: D80 (Role, bany, blokady – blokada). Branch `feature/86-blocking` z `feature/social`, merge do `feature/social`.

## Zakres

- Akcje `blockUser(nick)` / `unblockUser(nick)` (nie siebie; limit 60/min). Blokada w jednej transakcji logicznej: usuwa obserwacje w obie strony (71), zamyka rozmowę (85, `closedAt`), daje zablokowanemu ban w społeczności blokującego bez terminu (efekt przez `canInteract`, bez dokumentu w `communityBans`, więc odblokowanie go zdejmuje).
- „Zablokuj” na profilu i w menu ⋮ komentarza; lista zablokowanych z odblokowaniem w dialogu ustawień.
- Przegląd wszystkich miejsc odczytu: komentarze, reakcje (lista nicków), feed, powiadomienia, podpowiedzi nicków, rankingi, listy obserwujących, wyniki wyszukiwania profili – zablokowani przez widza ukryci (`hiddenAuthorsFor`). Publiczne teksty blokującego dalej czytelne dla zablokowanego.
- Test macierzowy: każda interakcja z D80 (komentarz, odpowiedź, reakcja, ocena, wzmianka, DM, obserwowanie, post forum – gdy 87 gotowe, dopisany tam) w obu kierunkach blokady.

## Kryteria akceptacji

1. Zablokowany nie pisze DM, nie odpowiada na komentarze blokującego, nie wspomina go, nie obserwuje go i nie komentuje, nie reaguje ani nie ocenia u niego (jako autora).
2. Blokujący nie widzi komentarzy i postów zablokowanego nigdzie.
3. Zablokowany nadal czyta publiczne teksty blokującego.
4. Blokada usuwa obserwacje w obie strony i zamyka rozmowę; odblokowanie przywraca możliwość interakcji (bez przywracania obserwacji).
5. Lista zablokowanych w ustawieniach z odblokowaniem.

## Testy

- Integracyjne: `tests/integration/blocking.test.ts` (1 jako macierz interakcji × kierunek, 2, 4).
- E2E: `tests/e2e/blocking.spec.ts` (`alice` blokuje `dave`: 2, 3, 5 i odmowa DM w UI).
