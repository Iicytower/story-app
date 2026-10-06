# 02 – Połączenie z bazą i modele

Spec: „Model danych”, „Indeksy”, „Uwagi implementacyjne”; decisions.md D1.

## Zakres

- Moduł połączenia Mongoose cache'owany globalnie (`globalThis`), odczyt `MONGODB_URI`.
- Model `Story`: `userId` (ObjectId, wymagany), `title`, `content`, `notes`, `createdAt`, `updatedAt`, `shareToken` (opcjonalny), `deletedAt` (zawsze zapisany, domyślnie `null`).
- Indeksy w schemacie:
  - unikalny częściowy na `{ userId, title }`, filtr `{ deletedAt: { $type: "null" } }`,
  - `{ userId: 1, updatedAt: -1 }`,
  - unikalny częściowy na `shareToken`, filtr `{ shareToken: { $type: "string" } }`.
- Rejestracja `mongoose.models.Story ?? mongoose.model(...)`.
- Model `User`: `email` (unikalny, lowercase), `passwordHash`, `createdAt`.
- Helper serializujący wynik `.lean()` (`_id` → `id: string`, daty → ISO string).

## Kryteria akceptacji

- Pierwsze uruchomienie tworzy indeksy bez błędu (zweryfikować operatory filtra w dokumentacji MongoDB).
- Wiele opowiadań bez `shareToken` nie koliduje; tytuł usuniętego opowiadania można użyć ponownie; dwóch użytkowników może mieć ten sam tytuł.

## Testy

- Infrastruktura: MongoDB w Dockerze (D3) + helper startu/czyszczenia bazy dla testów integracyjnych.
- `tests/integration/models.test.ts` (po `syncIndexes()`):
  - drugi aktywny `Story` z tym samym `userId` + `title` → błąd duplikatu,
  - ten sam tytuł u innego użytkownika → OK,
  - ten sam tytuł, gdy poprzedni ma `deletedAt` → OK,
  - tytuł różniący się wielkością liter → OK,
  - wiele opowiadań bez `shareToken` → OK; dwa z tym samym tokenem → błąd,
  - nowy dokument ma `deletedAt: null`,
  - duplikat e-maila w `users` → błąd; e-mail zapisany lowercase.
- Jednostkowy: serializacja (`id` string, daty ISO).
