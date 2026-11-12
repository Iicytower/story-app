# D26 – Lokalny backup bazy (2026-10-28)

Status: aktualna.

- Zmienia zakres taska 16. Skrypt `scripts/backup.sh` (bash + Docker) zamiast `scripts/backup.ts` przez `tsx`: ma działać niezależnie od aplikacji (docelowo także na VPS, automatyzacja później i poza repo). Bash nie mówi protokołem MongoDB, więc `mongodump` działa w kontenerze `mongo:8`; bez Dockera trzeba by instalować MongoDB Database Tools.
- URI z `MONGODB_URI` w `.env.prod` (plik nie jest wczytywany przez `source`, bo URI Atlasa zawiera `&`); brak pliku lub zmiennej → pytanie o URI. Nazwa bazy w URI wymagana, `mongodump` dostaje ją jawnie (`--db`).
- Katalog docelowy poza repo: `/home/$USER/backups/story_app/<czas UTC>/` (UTC, żeby nazwy sortowały się chronologicznie także przy zmianie czasu), więc nic do `.gitignore`. W środku: `<baza>.archive.gz` (pełny backup z indeksami) i `json/<kolekcja>.json` (`mongoexport`, tablica, relaxed Extended JSON) do czytania i odtwarzania pojedynczych kolekcji. Nazwy kolekcji z tymczasowego `mongodump` wewnątrz kontenera, bo `mongosh` przyjmuje URI tylko w argumencie.
- Zostaje 5 najnowszych backupów. Odtwarzanie tylko jako instrukcja w `deploy.md` (bez `npm run restore`).
- Testy uruchamiają skrypt z `ENV_FILE` i `BACKUP_DIR` wskazującymi na katalog tymczasowy i bazy `story_app_test_*`; nigdy `.env.prod`.
