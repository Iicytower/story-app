# D57 – Lokalny serwer narzędzi: polecenia, konto, proxy (2026-11-06)

Status: aktualna.

- Decyzje użytkownika (task 54). Jedno polecenie startuje całość, jedno zatrzymuje: `npm run up` (MongoDB, Coolify, serwer docelowy, wdrożenie bramki, zmienne w `.env.local`) i `npm run down` (`docker compose --profile tools down`, wolumeny zostają). `npm run db:down` usunięty; `npm run db:up` zostaje dla samego MongoDB, tak jak w testach.
- Konto admina Coolify, włączenie API i token zakłada skrypt przez `php artisan tinker` w kontenerze, nie seeder `ROOT_USER_*`: seeder wymaga e-maila z rekordem DNS, sprawdza hasło w HaveIBeenPwned i przy błędzie tylko loguje. Token odtwarzany przy każdym uruchomieniu (stary o tej samej nazwie usuwany).
- Serwer docelowy bez proxy (`proxy_type: none`): port bramki idzie wprost do Caddy, jak we wniosku z testu z 2026-11-01. Traefik dojdzie, gdy będzie potrzebna domena.
- Skrypt w TypeScripcie (`scripts/tools.ts`, `tsx`), bez `curl`/`jq` na hoście; klucz SSH generowany w kontenerze. Porty tylko na `127.0.0.1`: panel 8000 (realtime 6001, 6002), bramka 8110. Wersje przypięte: Coolify 4.6.0, Postgres 15.19, Redis 7.4.12, `docker:29.9.3-dind`, Caddy 2.11.9.
