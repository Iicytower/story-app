# Wdrożenie – migracje

Część `docs/deploy.md` (indeks i wydania tam).

## Migracje

Mechanizm: `docs/decisions.md` D14. Migracje uruchamiają się w buildzie produkcji i stagingu (`vercel.json` → `buildCommand`), przed `next build`. Preview innych branchy je pomijają.

- **Przy wydaniu:** migracja wykonuje się na stagingu przy merge'u do `staging`, a na produkcji przy merge'u do `main`. W trakcie builda ruch dalej obsługuje stary deployment, więc migracje są expand-only. Przed merge'em do `main` sprawdzić w logu builda stagingu linie `Applying <id>` i `Indexes synced`.
- **Nieudany build:** migracja z błędem nie jest zapisana w `migrations`, a blokada jest zwalniana. Kolejny deploy powtarza migrację, a kopia z pierwszej próby zostaje.
- **Odtworzenie z kopii** (mongosh na właściwej bazie). Najpierw „Promote” poprzedniego deploymentu, potem:
  ```js
  db.getCollection("stories_backup_002-folders").aggregate([{ $out: "stories" }]);
  db.migrations.deleteOne({ _id: "002-folders" }); // tylko jeśli migracja ma się wykonać ponownie
  ```
  `$out` zastępuje zawartość `stories` i zachowuje istniejące indeksy kolekcji docelowej. Kopia tylko ostatniej migracji, bez `covers` i `avatars` (D68, task 70): `db.getCollectionNames().filter(n => n.includes("_backup_"))`. Okładki i avatary odtwarza się z backupu `scripts/backup.sh`, więc przed wydaniem z migracją warto go zrobić.
- **Ręczne zdjęcie blokady**, gdy build padł w trakcie migracji, a nie chcesz czekać 15 min na jej przejęcie. Sprawdź najpierw, czy żaden build nie trwa: `db.migrations.deleteOne({ _id: "lock" })`.
- **Okno builda:** stary deployment obsługuje ruch, dopóki nowy nie wejdzie. Po `002-folders` stary kod (v1.0) może utworzyć opowiadanie bez `folderId`. `002-folders` jest powtarzalna, więc kolejny deploy przypisze je do „Unsorted” (przy kolizji tytułu z sufiksem „ (2)”). Do tego czasu opowiadanie jest widoczne w wyszukiwaniu i w edytorze, ale nie na liście folderów. Sprawdzenie: `db.stories.countDocuments({ folderId: { $exists: false } })`. Podobnie `003-positions` (też powtarzalna) dopisuje przy kolejnym deployu `position` folderom i rozdziałom utworzonym w oknie builda.
- **Pierwsze wydanie z `002-folders` (staging i produkcja):** v1.0 nie ma `autoIndex: false`, więc jego zimny start w trakcie builda odtwarza usunięty indeks `userId_1_title_1`. Nowy kod sam go nie usunie, a ten sam tytuł w dwóch folderach dostaje wtedy `DUPLICATE_TITLE`. Dlatego po wejściu nowego deploymentu trzeba zrobić jeden **Redeploy** (jego `syncIndexes()` usunie indeks, a działający kod już go nie odtworzy) i sprawdzić `db.stories.getIndexes()`: nie może być `userId_1_title_1`. To samo po rollbacku („Promote”) do v1.0 i ponownym wydaniu.
- **Wydanie z taskiem 36 (nick, bez migracji):** przed merge'em do `staging` i osobno przed merge'em do `main` trzeba ustawić nick właściciela w odpowiedniej bazie (mongosh): `db.users.updateOne({ email: "<e-mail>" }, { $set: { nickname: "<nick>" } })`. Konto bez nicku nie zaloguje się na nowym deploymencie. Stary deployment dalej loguje e-mailem, bo pole `email` zostaje. `syncIndexes()` w buildzie usuwa `email_1` i buduje `nickname_1`.
- **Lokalnie:** `npm run migrate` (baza z `.env.local`). Aplikacja nie tworzy indeksów sama (`autoIndex: false`), więc po zmianie schematu trzeba uruchomić migrację.
