# 01 – System migracji bazy

Własny, lekki system migracji bez nowych pakietów. Migracje uruchamiają się automatycznie w buildzie Vercela (produkcja i staging) i przed każdą z nich robiona jest kopia kolekcji w tej samej bazie.

## Zakres

- Folder `migrations/` z plikami `NNN-<slug>.ts`, każdy eksportuje `id` (np. `"001-example"`) i `up(db)`, gdzie `db` to natywny driver (`mongoose.connection.db`). Migracje są idempotentne: drugie uruchomienie niczego nie zmienia.
- Kolekcja `migrations`: dokument na migrację (`_id: id`, `appliedAt`). Wykonujemy tylko niezapisane, w kolejności nazw plików.
- `lib/migrate.ts` (logika) + `scripts/migrate.ts` (CLI). Kolejność: blokada → kopia → `up` → zapis w `migrations` → na końcu `syncIndexes()` dla wszystkich modeli (usuwa stare i tworzy nowe indeksy).
- `syncIndexes()` wykonuje się przy każdym uruchomieniu, także bez nowych migracji.
- `connectDB` dostaje `autoIndex: false`. Od teraz indeksami zarządza tylko skrypt migracji, bo inaczej stary deployment przy zimnym starcie odtwarzałby usunięte indeksy. Testy dalej wołają `syncIndexes()` same.
- **Blokada:** atomowy insert dokumentu `_id: "lock"` w `migrations` (ze `startedAt`). Drugi proces dostaje duplicate key i kończy się błędem z czytelnym komunikatem. Blokadę starszą niż 15 min można przejąć, bo po padniętym buildzie nie ma kto jej zwolnić.
- **Kopia:** przed każdą migracją kolekcje z listy `collections` w migracji kopiowane są do `<kolekcja>_backup_<id>`, np. przez `aggregate([{ $out }])`. Przed implementacją trzeba sprawdzić w dokumentacji Atlasa, czy `$out` działa na M0, bo jeśli nie, to kopiujemy przez `find` + `insertMany`. Trzymamy kopie z 3 ostatnich migracji, starsze usuwamy. M0 ma limit 512 MB, a kopia podwaja dane.
- **Uruchamianie w buildzie Vercela:** osobny punkt wejścia, nie skrypt `build`, bo `npm run build` uruchamia się też lokalnie i w E2E (`playwright.config.ts`). W dokumentacji Vercela sprawdzić, którego mechanizmu użyć: skryptu `vercel-build` czy Build Command w `vercel.json`. Polecenie: `tsx scripts/migrate.ts && next build`.
- **Warunek uruchomienia** (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`): migruje tylko `production` i preview z brancha `staging`. Pozostałe preview (`feature/*`) pomijają migrację z komunikatem w logu. Brak `MONGODB_URI` na produkcji lub stagingu kończy build błędem.
- Lokalnie: `npm run migrate` (`--env-file=.env.local`).
- **Zasada expand-only:** migracja działa, gdy stary deployment wciąż obsługuje ruch. Stary kod zostaje też na zmigrowanych danych po nieudanym buildzie i po rollbacku („Promote”). Dlatego migracja tylko dodaje pola, uzupełnia dane i dodaje indeksy. Usunięcie lub zmiana nazwy pola wchodzi najwcześniej w kolejnym wydaniu.
- Dokumentacja: nowa decyzja w `docs/decisions.md` (mechanizm, expand-only, kopie, blokada), sekcja „Migracje” w `docs/deploy.md` (kolejność przy wydaniu, odtworzenie z kopii, ręczne zdjęcie blokady), komenda w `CLAUDE.md`.
- Bez `down`: rollback to „Promote” poprzedniego deploymentu, a dane odtwarzamy z kopii.

## Kryteria akceptacji

1. `npm run migrate` na pustej bazie wykonuje wszystkie migracje i zapisuje je w `migrations`.
2. Ponowne uruchomienie nie wykonuje żadnej migracji i nie zmienia danych.
3. Przed migracją powstaje kopia kolekcji z jej listy (ta sama liczba i treść dokumentów), zostają kopie tylko 3 ostatnich migracji.
4. Gdy trwa inna migracja (aktywna blokada), skrypt kończy się błędem bez zmian w danych. Blokadę starszą niż 15 min przejmuje.
5. Błąd w `up` przerywa skrypt z kodem ≠ 0, nie zapisuje migracji jako wykonanej i zwalnia blokadę.
6. Po migracjach `syncIndexes()` usuwa indeks nieobecny w schemacie i tworzy nowy; dzieje się to także, gdy nie ma nowych migracji.
10. Aplikacja nie tworzy indeksów przy starcie (`autoIndex: false`).
7. Warunek środowiska: production i `staging` migrują, `feature/*` pomija, brak URI na production/staging = błąd.
8. Build na Vercelu dla `staging` uruchamia migrację przed `next build` (`manual`: log builda na Vercelu).
9. `npm run build` lokalnie i w E2E nie uruchamia migracji.

## Testy

- Integracyjne (`tests/integration/migrate.test.ts`, migracje testowe przekazywane do `lib/migrate.ts` jako argument): kryteria 1–6.
- Jednostkowe: funkcja decydująca o uruchomieniu na podstawie zmiennych środowiskowych (kryterium 7).
- Kryterium 10: test integracyjny, że po `connectDB` i użyciu modelu na pustej bazie nie ma indeksów spoza `_id`.
- Kryterium 9: test jednostkowy, że skrypt `build` w `package.json` nie zawiera migracji.
- Kryterium 8: `manual`.
