# Wdrożenie

## Środowiska

| Środowisko | Branch | Vercel | Baza (Atlas, ten sam klaster) |
| --- | --- | --- | --- |
| Produkcja | `main` | Production | `story-app` |
| Staging | `staging` | Preview, zmienne przypięte do brancha `staging` | `story-app-staging` |
| Lokalnie | dowolny | – | Docker, `story_app` (`npm run db:up`) |

- Vercel: Settings → Environment Variables → `MONGODB_URI` i `AUTH_SECRET` dla **Preview** z wybranym branchem `staging`. Inny `AUTH_SECRET` niż na produkcji. URI różni się od produkcyjnego tylko nazwą bazy (`.../story-app-staging?...`).
- Preview innych branchy (`feature/*`) nie dostaje zmiennych, więc nie łączy się z żadną bazą.
- Stały adres stagingu: branch URL `story-app-git-staging-iicytowers-projects.vercel.app` (nie URL-e deploymentów z hashem).
- Konto na stagingu: `MONGODB_URI='mongodb+srv://.../story-app-staging?...' npm run create-account` (niepotrzebne, jeśli baza zaimportowana z produkcji).

## Stan stagingu (2026-10-20)

- [x] Baza `story-app-staging` w Atlasie, dane zaimportowane z produkcji.
- [x] Vercel → Environment Variables: `MONGODB_URI` i własny `AUTH_SECRET` dla Preview, branch `staging`.
- [x] Adres: `story-app-git-staging-iicytowers-projects.vercel.app` (branch URL Vercela, za Deployment Protection).
- [x] Smoke test na stagingu.

## Wydanie

1. Taski zmergowane do `develop`, potem `develop` → `staging` i smoke test na stagingu.
2. Merge `staging` → `main` robi użytkownik (nigdy push na `main` z lokalnego repo), potem tag `vX.Y.Z` → deploy produkcji.
3. Rollback: „Promote” poprzedniego deploymentu w Vercelu.

## Migracje

Mechanizm: `docs/decisions.md` D14. Migracje uruchamiają się w buildzie produkcji i stagingu (`vercel.json` → `buildCommand`), przed `next build`. Preview innych branchy je pomijają.

- **Przy wydaniu:** migracja wykonuje się na stagingu przy merge'u do `staging`, a na produkcji przy merge'u do `main`. W trakcie builda ruch dalej obsługuje stary deployment, więc migracje są expand-only. Przed merge'em do `main` sprawdzić w logu builda stagingu linie `Applying <id>` i `Indexes synced`.
- **Nieudany build:** migracja z błędem nie jest zapisana w `migrations`, a blokada jest zwalniana. Kolejny deploy powtarza migrację, a kopia z pierwszej próby zostaje.
- **Odtworzenie z kopii** (mongosh na właściwej bazie). Najpierw „Promote” poprzedniego deploymentu, potem:
  ```js
  db.getCollection("stories_backup_002-folders").aggregate([{ $out: "stories" }]);
  db.migrations.deleteOne({ _id: "002-folders" }); // tylko jeśli migracja ma się wykonać ponownie
  ```
  `$out` zastępuje zawartość `stories` i zachowuje istniejące indeksy kolekcji docelowej. Kopie 3 ostatnich migracji: `db.getCollectionNames().filter(n => n.includes("_backup_"))`.
- **Ręczne zdjęcie blokady**, gdy build padł w trakcie migracji, a nie chcesz czekać 15 min na jej przejęcie. Sprawdź najpierw, czy żaden build nie trwa: `db.migrations.deleteOne({ _id: "lock" })`.
- **Okno builda:** stary deployment obsługuje ruch, dopóki nowy nie wejdzie. Po `002-folders` stary kod (v1.0) może utworzyć opowiadanie bez `folderId`. `002-folders` jest powtarzalna, więc kolejny deploy przypisze je do „Unsorted” (przy kolizji tytułu z sufiksem „ (2)”). Do tego czasu opowiadanie jest widoczne w wyszukiwaniu i w edytorze, ale nie na liście folderów. Sprawdzenie: `db.stories.countDocuments({ folderId: { $exists: false } })`. Podobnie `003-positions` (też powtarzalna) dopisuje przy kolejnym deployu `position` folderom i rozdziałom utworzonym w oknie builda.
- **Pierwsze wydanie z `002-folders` (staging i produkcja):** v1.0 nie ma `autoIndex: false`, więc jego zimny start w trakcie builda odtwarza usunięty indeks `userId_1_title_1`. Nowy kod sam go nie usunie, a ten sam tytuł w dwóch folderach dostaje wtedy `DUPLICATE_TITLE`. Dlatego po wejściu nowego deploymentu trzeba zrobić jeden **Redeploy** (jego `syncIndexes()` usunie indeks, a działający kod już go nie odtworzy) i sprawdzić `db.stories.getIndexes()`: nie może być `userId_1_title_1`. To samo po rollbacku („Promote”) do v1.0 i ponownym wydaniu.
- **Lokalnie:** `npm run migrate` (baza z `.env.local`). Aplikacja nie tworzy indeksów sama (`autoIndex: false`), więc po zmianie schematu trzeba uruchomić migrację.

## Ustalenia

- Wdrożenie: import repo `Iicytower/story-app` z GitHuba w panelu Vercela. Każdy push na `main` wdraża produkcję, push na `staging` – staging.
- `AUTH_SECRET` generowany lokalnie (`openssl rand -base64 32`), nigdy nie wklejany do rozmowy z Claude.
- Atlas: Network Access `0.0.0.0/0`, użytkownik z silnym hasłem i rolą `readWrite`. W URI nazwa bazy przed `?` (`.../story_app?retryWrites=true&w=majority`), inaczej Mongoose użyje bazy `test`.
- Atlas M0 nie ma automatycznych backupów (dopiero Flex i wyżej). Backup: `scripts/backup.sh` (sekcja „Backup bazy”, D26).
- Function Region w Vercelu (Settings → Functions) ustawić na region klastra Atlasa (np. `fra1` dla Frankfurtu). Domyślnie funkcje szły do `iad1` (Waszyngton).
- Konto produkcyjne: `MONGODB_URI='mongodb+srv://...' npm run create-account` (pojedyncze cudzysłowy, bo zsh interpretuje `&` i `?`; plik `.env.local` musi istnieć).

## Backup bazy

`scripts/backup.sh` (D26): sam bash + Docker (`mongodump` i `mongoexport` w kontenerze `mongo:8`), bez Node i kodu aplikacji, więc da się go skopiować i uruchomić np. na VPS. Uruchamia użytkownik: `npm run backup` albo `bash scripts/backup.sh`.

- URI: `MONGODB_URI` z `.env.prod` w katalogu repo (inny plik: `ENV_FILE=/ścieżka`). Brak pliku lub zmiennej → skrypt pyta o URI (wpisywanie ukryte). URI musi zawierać nazwę bazy (`.../story-app?...`).
- Wynik: `/home/$USER/backups/story_app/<czas UTC>/` (inny katalog: `BACKUP_DIR=/ścieżka`, tworzony, jeśli nie istnieje), np. `2026-10-28T12-00-00Z/`:
  - `<baza>.archive.gz` – całe archiwum (`mongodump --archive --gzip`);
  - `json/<kolekcja>.json` – każda kolekcja osobno (`mongoexport --jsonArray --pretty`, relaxed Extended JSON: `{"$oid": ...}`, `{"$date": ...}`). Do czytania i odtwarzania pojedynczej kolekcji; bez indeksów, więc pełne odtworzenie bazy – z archiwum.
- Zostaje 5 najnowszych backupów; starsze katalogi z nazwą w formacie znacznika czasu są usuwane po udanym backupie. Inne katalogi nie są ruszane.
- Błąd (brak URI, Dockera, połączenia) → komunikat, kod ≠ 0, katalog tego uruchomienia usunięty. Hasło z URI nie trafia na wyjście ani na listę procesów (URI przekazywany do kontenera w pliku konfiguracyjnym).
- Wymaga uprawnień do Dockera (grupa `docker`). Na Linuksie kontener korzysta z sieci hosta (`--network host`), więc działa też baza na `127.0.0.1`.

### Odtwarzanie

Poniższe komendy sprawdza test `tests/integration/backup.test.ts`. `BACKUP` to katalog backupu, `SRC` nazwa bazy z backupu, `DST` nazwa bazy docelowej, `URI` adres bazy docelowej **z jej nazwą**.

```sh
BACKUP=/home/$USER/backups/story_app/2026-10-28T12-00-00Z SRC=story-app DST=story-app-restore
URI="mongodb+srv://.../$DST?retryWrites=true&w=majority"

# z archiwum (zmienia nazwę bazy z SRC na DST)
docker run --rm --network host -v "$BACKUP:/backup:ro" mongo:8 mongorestore --uri "$URI" --gzip \
  --archive="/backup/$SRC.archive.gz" --nsInclude "$SRC.*" --nsFrom "$SRC.*" --nsTo "$DST.*"

# albo jedna kolekcja z JSON (bez indeksów; w nowej bazie odtworzy je: MONGODB_URI="$URI" npm run migrate)
docker run --rm --network host -v "$BACKUP:/backup:ro" mongo:8 mongoimport --uri "$URI" \
  --collection=stories --jsonArray --file=/backup/json/stories.json
```

- `mongorestore` i `mongoimport` nie nadpisują istniejących dokumentów (duplikaty `_id` są pomijane z błędem). Najbezpieczniej odtwarzać do nowej bazy, sprawdzić dane i dopiero wtedy przełączyć `MONGODB_URI` albo skopiować kolekcje.
- `--drop` (oba narzędzia) usuwa kolekcje docelowe przed odtworzeniem. **Na produkcji tylko po świeżym backupie bieżącego stanu** i przy zatrzymanym ruchu (inaczej zapisy w trakcie przepadną).
- URI w argumencie `--uri` jest widoczny na liście procesów; na współdzielonej maszynie użyć `--config` z plikiem `uri: '...'` (jak w skrypcie).

## Problem: JSON „There was a problem with the server configuration” po logowaniu

- Objaw: 500 na `/api/auth/callback/credentials`, w logu „No outgoing requests” (do Atlasa nic nie poszło).
- Ten JSON Auth.js zwraca tylko przy nieudanej kontroli konfiguracji: `MissingSecret`, `UntrustedHost` albo `InvalidCallbackUrl`. Błąd bazy lub hasła dałby „Invalid email or password.”.
- Pierwsza przyczyna: zmienne dodane po deployu. Vercel wczytuje zmienne dopiero przy deployu, więc po zmianie potrzebny **Redeploy**.
- Druga przyczyna: testowanie przez URL konkretnego deploymentu (`story-<hash>-iicytowers-projects.vercel.app`). Taki URL jest na stałe przypięty do jednej wersji, więc po redeployu dalej działał stary deployment bez zmiennych (ten sam Deployment ID w logach). Trzeba otwierać **domenę produkcyjną** z Settings → Domains (bez hasha) i wyczyścić cookies starego URL-a.
- Diagnostyka: w Logs szukać linii `[auth][error]` i porównać Deployment ID oraz region funkcji z oczekiwanymi.
- Awaryjnie: `AUTH_TRUST_HOST=true` + redeploy. Jeśli to pomoże, przyczyną był `UntrustedHost` i trzeba poprawić D4 w `decisions.md`.

## Smoke test

1. `/` przekierowuje na `/login`; błędne hasło → „Invalid email or password.”, poprawne loguje.
2. Utworzenie opowiadania, treść, autozapis („Saved”); po odświeżeniu treść zostaje.
3. „Export as…” pobiera plik w wybranym formacie.
4. „Share”: link w incognito pokazuje opowiadanie bez notatek i komentarzy; po „Stop sharing” 404.
5. Przełącznik motywu i wylogowanie.
6. Foldery: nowy folder, rozdział o tym samym tytule w dwóch folderach, przeniesienie rozdziału, notatki folderu z autozapisem.
