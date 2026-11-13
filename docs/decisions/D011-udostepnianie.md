# D11 – Szczegóły udostępniania (2026-10-06)

Status: archiwalna – zastąpiona przez D38 (publikacja zamiast linków).

- `shareToken` z `node:crypto`: `randomBytes(16).toString("base64url")` (22 znaki, 128 bitów) zamiast `nanoid` – bez nowej zależności.
- Ponowne „Share” przy włączonym udostępnianiu zwraca ten sam token (warunek `shareToken: { $exists: false }` w filtrze), więc dwie karty lub podwójny klik nie unieważniają wysłanego linku. Nowy token dopiero po „Stop sharing” i ponownym „Share”.
- `setSharing` zwraca `{ ok: true, sharePath: "/s/<token>" | null }`; pełny URL składa klient z `window.location.origin`.
- `setSharing` nie zmienia `updatedAt` (`timestamps: false`), żeby otwarty edytor nie dostał `CONFLICT` przy następnym zapisie i żeby lista nie zmieniała kolejności.
- Soft delete nie usuwa tokenu; link przestaje działać dzięki filtrowi `deletedAt: null` na stronie publicznej.
- Strona `/s/[token]` wywołuje `connection()`, żeby nie była cache'owana (inaczej link działałby po „Stop sharing”). `noindex`: `metadata.robots` (meta tag) + `X-Robots-Tag: noindex, nofollow` przez `headers()` w `next.config.ts`.
- `stripComments`: komentarz kończy się na pierwszym `-->` (jak w HTML), więc z zagnieżdżonego `<!-- a <!-- b --> c -->` zostaje ` c -->`.
