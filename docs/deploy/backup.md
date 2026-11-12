# Wdrożenie – backup bazy

Część `docs/deploy.md` (indeks i wydania tam).

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
