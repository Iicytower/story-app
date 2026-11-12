# D71 – Typy argumentów Server Actions (2026-11-09)

Status: aktualna.

- Task 61, decyzje użytkownika: własne guardy w `lib/action-input.ts` (`isString`, `isBoolean`, `isId`, `isIsoDate`) na początku akcji, bez `zod`.
- Argument złego typu zwraca `INVALID_INPUT` z komunikatem `requestInvalid` (albo istniejącym komunikatem akcji, np. `coverInvalid`, `detailsInvalid`). ID złego typu (nie string z 24 znakami hex) to `NOT_FOUND`, jak nieistniejące ID (D1); `isId` zastępuje w akcjach `isObjectIdOrHexString`, które przepuszcza obiekt z `_bsontype`.
- `expectedUpdatedAt` i `expectedNotesUpdatedAt` muszą być dokładnie w formacie `toISOString()`, który wysyła serwer.
