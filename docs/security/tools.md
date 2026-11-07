# Narzędzia i artefakty testów bezpieczeństwa

Lista tego, czego używały testy w `docs/security/`, i co po nich zostaje do ewentualnego usunięcia. Każdy kolejny test dopisuje tu swoje narzędzia.

## 2026-11-07 ([raport](pentest-2026-11-07.md))

### Narzędzia

Nic nie było instalowane – ani z repozytorium Debiana, ani obrazy Dockera. Użyte tylko narzędzia już obecne:

| Narzędzie | Skąd | Do czego |
| --- | --- | --- |
| `curl` | system | nagłówki, bramka narzędzi, limit wyszukiwarki |
| `node` 24 (`fetch`) | system | skrypty wywołujące Server Actions i Auth.js |
| `npx tsx`, `next build`/`next start` | `node_modules` projektu | instancja testowa, konta, sprawdzenie `withLocale` |
| `npm audit` | npm | podatne zależności |
| `mongosh` | kontener `story_app-mongo-1` | odczyt bazy testowej |
| `openssl rand` | system | `AUTH_SECRET` instancji testowej |

Skrypty testowe leżały w scratchpadzie sesji Claude Code (poza repo, usuwany automatycznie).

### Artefakty do usunięcia

| Co | Jak usunąć |
| --- | --- |
| Baza `story_app_pentest` (konta `alice_pt`, `bob_pt`, `spam_*`, `spamx_*`, dane testowe) | `docker exec story_app-mongo-1 mongosh story_app_pentest --quiet --eval 'db.dropDatabase()'` |
| Build instancji testowej `.next-pentest/` (w `.gitignore`) | `rm -rf .next-pentest` |
| Proces `next start` na `127.0.0.1:3100` | kończy się z sesją Claude Code; inaczej `pkill -f "next start -H 127.0.0.1 -p 3100"` |
