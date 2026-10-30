# 16 – Lokalny backup bazy

Prośba użytkownika (2026-10-28): skrypt robiący backup bazy na komputer użytkownika. Atlas M0 nie ma automatycznych backupów (`deploy.md`); plan z `deploy.md`: `mongodump` przez `docker run --rm mongo:8 mongodump ...`, bez instalowania MongoDB Database Tools.

## Zakres

- Skrypt `scripts/backup.ts` + `npm run backup`: `mongodump` w kontenerze `mongo:8` z `MONGODB_URI` z pliku `.env.prod` (ustalenie z użytkownikiem 2026-10-28; `tsx --env-file=.env.prod`). Plik tworzy użytkownik; jest już ignorowany przez `.env*` w `.gitignore`.
- Wynik: archiwum `--archive --gzip` w katalogu z datą i nazwą bazy w nazwie pliku (np. `backups/story-app-2026-10-28T12-00-00.archive.gz`). Katalog w `.gitignore`.
- Odtwarzanie: `npm run restore` albo instrukcja `mongorestore` w `deploy.md`.
- Do ustalenia przy starcie (pytanie do użytkownika):
  - domyślny katalog docelowy (w repo, poza repo, konfigurowalny);
  - czy usuwać stare backupy (np. zostawić N ostatnich);
  - czy restore jako skrypt, czy tylko instrukcja; restore na produkcję tylko z potwierdzeniem;
  - czy automatyzować (cron / systemd timer na komputerze użytkownika) – konfigurację systemu robi użytkownik.
- Skrypt uruchamia użytkownik (jak `create-account`), Claude nie łączy się z bazą produkcyjną. URI nie trafia do logów.
- Opis w `deploy.md`.

## Kryteria akceptacji

1. `npm run backup` tworzy archiwum ze wszystkimi kolekcjami bazy z `MONGODB_URI` w `.env.prod`.
2. Nazwa pliku zawiera nazwę bazy i znacznik czasu; kolejne uruchomienia nie nadpisują poprzednich.
3. Archiwum da się odtworzyć do innej bazy i dane są identyczne.
4. Hasło z URI nie pojawia się w wyjściu skryptu.
5. Brak `.env.prod` lub `MONGODB_URI`, brak Dockera albo błąd połączenia kończy skrypt czytelnym komunikatem i kodem ≠ 0, bez pustego/uszkodzonego pliku.

## Testy

- Integracyjne (MongoDB w Dockerze, baza `story_app_test_*`): backup bazy testowej z danymi → restore do drugiej bazy testowej → porównanie dokumentów (1, 3); dwa uruchomienia → dwa pliki (2); wyjście bez hasła (4); błędny URI i brak `MONGODB_URI` → kod ≠ 0 i brak pliku (5). Testy podają URI bazy testowej przez zmienną środowiskową / argument, nigdy nie czytają `.env.prod`.
- `manual`: backup produkcji uruchomiony przez użytkownika.
