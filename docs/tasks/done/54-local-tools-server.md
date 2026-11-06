# 54 – Lokalny serwer narzędzi (Coolify w Dockerze)

Decyzja użytkownika (2026-11-06). Wszystko, co miało działać na Mikrusie (task 28), na czas developmentu działa lokalnie w Dockerze, z Coolify, jak na docelowym serwerze. Taski 29, 25 i zależne od nich budują usługi na tym środowisku, a prawdziwy serwer (28) powstaje na końcu (D56).

## Zakres

- `docker-compose.yml` w repo obejmuje wszystkie lokalne usługi. Dziś jest w nim `mongo`, a dochodzi:
  - Coolify (aplikacja, Postgres, Redis);
  - serwer docelowy: kontener z Dockerem w środku (DinD, `privileged`) i `sshd`, dodany w Coolify jako serwer, odpowiednik Mikrusa.
- Coolify wdraża na serwer docelowy usługę Compose z samą bramką: Caddy z sekretnym nagłówkiem `X-Tools-Secret` i ścieżką `/health`. LanguageTool dochodzi w tasku 29, a serwis słownikowy w tasku 25, jako kolejne usługi za tą bramką.
- Jedno polecenie (np. `npm run tools:up`) od zera:
  - startuje kontenery;
  - tworzy konto admina Coolify ze zmiennych;
  - generuje klucz SSH serwera docelowego;
  - dodaje serwer przez API Coolify;
  - tworzy projekt i usługę bramki, ustawia sekret i ją uruchamia;
  - czeka na `/health`;
  - dopisuje `TOOLS_API_URL` i `TOOLS_API_SECRET` do `.env.local`.
  
  Ponowne uruchomienie nie tworzy duplikatów. Do tego polecenie zatrzymujące (np. `npm run tools:down`).
- Sekrety (`APP_KEY` i hasła Coolify, hasło admina, `TOOLS_API_SECRET`) generowane lokalnie, w plikach z `.gitignore`, nigdy nie wypisywane.
- `.env.example` z pustymi `TOOLS_API_URL` i `TOOLS_API_SECRET`.
- Dokumentacja:
  - `docs/deploy.md`: środowisko lokalne, adres panelu, polecenia, wymiana sekretu, reset środowiska;
  - `README.md`: stack i uruchomienie;
  - `.claude/skills/local-setup/SKILL.md`: opcjonalny krok z narzędziami.

Poza zakresem: kod aplikacji (klient, flaga z D56: task 29), LanguageTool (29), serwis słownikowy (25), prawdziwy serwer (28).

## Ustalenia

- Usługi działają przez Coolify w DinD, a nie wprost w `docker-compose.yml`. Dzięki temu konfiguracja usług i sposób wdrożenia są te same co na Mikrusie (decyzja użytkownika).
- Nic nie instaluje się na hoście poza Dockerem: bez instalatora Coolify, bez `/data/coolify` i bez SSH do hosta (decyzja użytkownika).
- `npm run db:up`, `npm test` i `npm run test:e2e` dalej startują tylko `mongo`. Coolify i serwer docelowy nie są potrzebne do testów.
- Port bramki opublikowany tylko na `127.0.0.1`. Panel Coolify też tylko lokalnie.
- Testy aplikacji dalej nie łączą się z serwerem narzędzi (atrapy, `docs/testing.md`).

Do sprawdzenia na początku:

- **Plik bazowy Coolify.** Bazowy `docker-compose.yml` Coolify (`https://cdn.coollabs.io/coolify/docker-compose.yml`) ma stałe `container_name` (`coolify`, `coolify-db`, `coolify-redis`) i `host.docker.internal`. Nakładka `docker-compose.prod.yml` dokłada bind mounty do `/data/coolify/...`, `env_file` z `/data/coolify/source/.env`, zewnętrzną sieć `coolify` i globalne nazwy wolumenów (`coolify-db`, `coolify-redis`). Wszystko to trzeba zastąpić konfiguracją w repo (wolumeny projektu albo katalog z `.gitignore`). Sprawdzić prawa `9999:root` i `700` wymagane przez instalator.
- **Profile Compose.** Czy usługi Coolify pod profilem (np. `tools`) nie startują przy `docker compose up mongo`. Do tego: co robi `npm run db:down` (`docker compose down`) z kontenerami z profilu i czy dalej ma zatrzymywać wszystko.
- **Obraz serwera docelowego.** `docker:dind` nie ma `sshd`. Potrzebny własny obraz (Dockerfile w repo) z logowaniem roota po kluczu. Kontener DinD musi być `privileged`.
- **Serwer `localhost`.** Coolify sam zakłada serwer `localhost` wskazujący na `host.docker.internal`. Bez SSH na hoście jest nieosiągalny. Sprawdzić, czy nie przeszkadza (błędy w logach, walidacja), a usługi trafiają tylko na serwer DinD.
- **Konto admina.** `ROOT_USERNAME`, `ROOT_USER_EMAIL`, `ROOT_USER_PASSWORD` (hasło: wielka i mała litera, cyfra, symbol). Dokumentacja wymaga e-maila z poprawnym rekordem DNS, więc adres w `localhost` może zostać odrzucony.
- **Token API.** Jak skrypt dostaje token bez klikania w Keys & Tokens: API Coolify, `php artisan` w kontenerze albo inna droga.
- **Wersje.** Przypiąć obraz Coolify (`LATEST_IMAGE`), Caddy i DinD do wersji zamiast `latest`.
- **Zasoby.** Zmierzyć RAM i dysk całego stosu na hoście (w teście z 2026-11-01 sam Coolify zajmował ok. 0,5 GB).

## Dane z researchu

### Coolify

[Dokumentacja](https://coolify.io/docs/get-started/installation): minimum 2 rdzenie, 2 GB RAM, 30 GB dysku (nowsza wersja dokumentacji podaje 10 GB). Sam zajmuje ok. 300–400 MB. Buildy mocno obciążają CPU, więc obrazy lepiej pobierać gotowe. Instalacja ręczna (stan z 2026-11-06):

- pliki `docker-compose.yml`, `docker-compose.prod.yml` i `.env.production`;
- sekrety z `openssl`: `APP_ID`, `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`, `PUSHER_*`. Nie zmieniać ich po pierwszej instalacji;
- klucz ed25519 `id.root@host.docker.internal` w `/data/coolify/ssh/keys`;
- panel na porcie `APP_PORT` (domyślnie 8000).

Od 4.4 realtime działa w kontenerze `coolify`, a usługa `soketi` ma 0 replik.

### Bezpieczeństwo

Serwer LanguageTool nie ma uwierzytelniania, więc bez proxy z sekretem każdy może z niego korzystać. W teście działał osobny Caddy, sprawdzający nagłówek `X-Tools-Secret`. Usługi nie mogą nasłuchiwać bezpośrednio na IPv6 ani na publicznym porcie.

### Test w lokalnej instancji Coolify (2026-11-01)

Środowisko: lokalny sandbox z Coolify 4.5.3, serwerem docelowym w kontenerze z Dockerem 29.9.2 (tryb `privileged`, 8 rdzeni, 15,5 GB RAM) i Traefikiem 3.7.17. Wdrożono usługę Compose: bramkę Caddy, LanguageTool 6.8 i atrapę słownika. Wyniki LT są w tasku 29, a atrapy w tasku 25.

Wyniki **[pomiar]**:

| Sprawdzenie | Wynik |
| --- | --- |
| Bez sekretu, zły, pusty, `*` | 401 na `/health`, `/lt/*`, `/dict/*`, przez Traefik i na porcie 20123 |
| Poprawny sekret | 200 przez Traefik i na porcie 20123 |
| LT (8010) i słownik (8000) poza bramką | niedostępne, brak opublikowanych portów |
| Caddy bez zmiennej `TOOLS_API_SECRET` | kontener kończy się z kodem 1, usługa nie otwiera się bez sekretu |
| `docker restart` serwera docelowego | LT odpowiada po 17 s, wszystkie kontenery wróciły (`restart=unless-stopped`) |
| Nagłówki jak z `wykr.es` (`Host: srv55-20123.wykr.es`, `X-Forwarded-Proto: https`) na porcie 20123 | 401 bez sekretu, 200 z sekretem |
| Ten sam `Host` przez Traefik | 503, bo domena nie jest skonfigurowana |
| Domena `http://` w Coolify | etykiety Traefika bez TLS i resolvera, `acme.json` ma 0 bajtów, 0 wpisów o ACME w logach |

**[wniosek]** Port bramki kierować bezpośrednio na bramkę, z pominięciem Traefika.

Pamięć **[pomiar]** bez obciążenia, poza LT:

| Kontener | RAM |
| --- | --- |
| Coolify | 419–433 MB |
| Baza Coolify | 37–39 MB |
| Redis | 11–14 MB |
| Traefik | 31 MB |
| Sentinel | 3 MB |
| Bramka Caddy | 14 MB |
| Atrapa słownika | 12 MB |

Serwer docelowy razem z usługami zajmował 703 MB przy LT 474 MB. Cały stos to ok. 1,2 GB, a przy LT 665 MB ok. 1,4 GB **[wniosek]**. Obrazy zajmują 2,338 GB dysku.

Uwagi do Coolify:

- Tworzenie przez API:
  1. `POST /api/v1/projects`;
  2. `POST /api/v1/services` (`docker_compose_raw` w base64, `instant_deploy: false`, `urls`);
  3. `PATCH /services/{uuid}/envs`;
  4. `POST /services/{uuid}/start`.
  
  `/api/health` działa bez tokena, reszta wymaga tokena z zakładki Keys & Tokens. Specyfikacja API jest w kontenerze: `/var/www/html/openapi.yaml`.
- Adres `http://tools.localhost:8080` w `urls` daje domenę `http://tools.localhost` i etykietę portu kontenera 8080.
- Plik z `content:` zapisuje się tylko raz. `PATCH` na `docker_compose_raw` go nie zmienia, choć inne zmiany z compose, np. porty, wchodzą. Plik zmienia się przez `PATCH /services/{uuid}/storages`, a usługę trzeba zrestartować.
- Tuż po `restart` odpowiadają jeszcze stare kontenery, więc sprawdzanie od razu pokazuje starą konfigurację.
- Traefik ma `--ping.entrypoint=http`, więc przejmuje ścieżkę `/ping` na każdej domenie. Dlatego bramka używa `/health`.
- Status usługi to `running:unknown`, bo bramka i atrapa nie mają healthchecku.
- Sekret leży na serwerze w `/data/coolify/services/<uuid>/.env` z prawami 0644.
- Traefik publikuje `80`, `443` i `8080`, także na `[::]`.

Compose użyty w teście. Port 20123 był testowy, `TOOLS_API_SECRET` to zmienna usługi w Coolify, a obraz LT trzeba przypiąć do wersji. Usługa `dictionary` to atrapa. Task 54 bierze z niego samą bramkę (bez `/lt` i `/dict`), a taski 29 i 25 dopisują swoje usługi:

```yaml
services:
  gateway:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - '20123:8080'
    environment:
      - TOOLS_API_SECRET=${TOOLS_API_SECRET}
    volumes:
      - type: bind
        source: ./Caddyfile
        target: /etc/caddy/Caddyfile
        content: |
          {
            admin off
            auto_https off
          }
          :8080 {
            @authorized header X-Tools-Secret {$TOOLS_API_SECRET}
            handle @authorized {
              handle /health {
                respond "ok" 200
              }
              handle_path /lt/* {
                reverse_proxy languagetool:8010
              }
              handle_path /dict/* {
                reverse_proxy dictionary:8000
              }
              respond 404
            }
            respond 401
          }
    depends_on:
      - languagetool
      - dictionary
  languagetool:
    image: erikvl87/languagetool:latest
    restart: unless-stopped
    mem_limit: 800m
    cpus: '1'
    environment:
      - Java_Xms=128m
      - Java_Xmx=512m
  dictionary:
    image: python:3.13-alpine
    restart: unless-stopped
    mem_limit: 128m
    command: python /app/server.py
    volumes:
      - dict-data:/data
      - type: bind
        source: ./server.py
        target: /app/server.py
        content: |
          import json, sqlite3
          from http.server import BaseHTTPRequestHandler, HTTPServer
          from urllib.parse import parse_qs, urlparse
          db = sqlite3.connect("/data/dict.sqlite")
          db.execute("create table if not exists forms(form text, lemma text)")
          db.execute("create index if not exists forms_form on forms(form)")
          if not db.execute("select 1 from forms limit 1").fetchone():
              db.executemany("insert into forms values (?, ?)", [("kota", "kot"), ("kota", "kota"), ("psa", "pies")])
              db.commit()
          class H(BaseHTTPRequestHandler):
              def do_GET(self):
                  word = parse_qs(urlparse(self.path).query).get("word", [""])[0]
                  rows = db.execute("select lemma from forms where form = ?", (word,)).fetchall()
                  body = json.dumps({"lemmas": [r[0] for r in rows]}).encode()
                  self.send_response(200)
                  self.send_header("Content-Type", "application/json")
                  self.end_headers()
                  self.wfile.write(body)
          HTTPServer(("0.0.0.0", 8000), H).serve_forever()
volumes:
  dict-data:
```

## Kryteria akceptacji

1. Jedno polecenie na czystym repo (z Dockerem) stawia Coolify, serwer docelowy i bramkę, a na końcu `/health` z sekretem odpowiada 200.
2. Ponowne uruchomienie polecenia nie tworzy drugiego serwera, projektu ani usługi i nie zmienia sekretu.
3. `/health` bez sekretu, ze złym i z pustym sekretem daje 401.
4. Port bramki i panel Coolify są dostępne tylko na `127.0.0.1`.
5. Po restarcie serwera docelowego i po `tools:down` + `tools:up` bramka znowu odpowiada.
6. `TOOLS_API_URL` i `TOOLS_API_SECRET` trafiają do `.env.local`, a sekrety nie są w repo ani na wyjściu skryptu.
7. `npm run db:up` i testy (`npm run verify`) nie startują Coolify ani serwera docelowego.
8. Na hoście nie powstaje nic poza kontenerami, wolumenami, siecią projektu i plikami z `.gitignore` w repo.
9. `docs/deploy.md`, `README.md`, `.env.example` i skill `local-setup` opisują środowisko.

## Testy

Bez testów automatycznych: to infrastruktura, a testy aplikacji nie łączą się z siecią (`docs/testing.md`). `manual`: wszystkie kryteria, z wynikami `curl`, listą kontenerów (`docker compose ps`) i pomiarem RAM. Kryterium 7: `npm run verify` przy zatrzymanym środowisku narzędzi.
