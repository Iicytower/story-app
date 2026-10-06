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
