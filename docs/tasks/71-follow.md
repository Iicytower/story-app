# 71 – Obserwowanie autorów

Subtask 68, zależy od 70. Podstawa: D80 (Profil, relacje, biblioteka – obserwowanie; Role, bany, blokady – blokada usuwa obserwację). Branch `feature/71-follow` z `feature/social`, merge do `feature/social`.

## Zakres

- Kolekcja `follows` (`followerId`, `followeeId`, `createdAt`, unikalny para, indeks po `followeeId`).
- Akcje `follow(nick)` / `unfollow(nick)`: wymaga logowania, nie można obserwować siebie, `canInteract(kind: "follow")` (blokada w dowolną stronę → odmowa), limit `takeUserAttempt` (reguła z reakcjami, 60/min).
- Przycisk Obserwuj / Obserwujesz na profilu; gość → dialog logowania.
- Listy `/p/<nick>/followers` i `/p/<nick>/following` (stronicowane po 50), liczniki na profilu. Konta usunięte i zablokowane przez widza pomijane.
- Wpis w `activity` (dla feedu 75) nie powstaje; zdarzenie „nowy obserwujący” zostawia hak dla powiadomień (81).

## Kryteria akceptacji

1. Zalogowany obserwuje i przestaje obserwować; podwójne obserwowanie nie tworzy duplikatu.
2. Obserwowanie siebie i użytkownika w relacji blokady → odmowa.
3. Listy i liczniki obserwujących/obserwowanych zgodne z bazą, widoczne dla gościa.
4. Gość klikający Obserwuj dostaje dialog logowania.

## Testy

- Integracyjne: `tests/integration/follows.test.ts` (1, 2, unikalny indeks, limit), `tests/integration/profile.test.ts` (3, liczniki).
- E2E: `tests/e2e/follow.spec.ts` (`dave` obserwuje `alice`, listy, gość – kryteria 1, 3, 4).
