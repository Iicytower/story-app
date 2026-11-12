# Wdrożenie – serwer narzędzi

Część `docs/deploy.md` (indeks i wydania tam).

## Lokalny serwer narzędzi (task 54, D56, D57, D58, D61)

Odpowiednik prawdziwego serwera narzędzi (task 28), w całości w Dockerze. Usługi z profilu `tools` w `docker-compose.yml`:

- `coolify`, `coolify-db`, `coolify-redis` – Coolify 4.6.0 (pliki bazowe Coolify przerobione na wolumeny projektu, bez `/data/coolify` na hoście);
- `tools-server` – serwer docelowy: DinD z `sshd` (`docker/tools-server/`), dodany w Coolify jako serwer `story-app-tools`, bez proxy (`proxy_type: none`).

Coolify wdraża na `tools-server` usługę Compose `story-app-tools` z `docker/tools/compose.yml`: bramka Caddy z nagłówkiem `X-Tools-Secret`, ścieżką `/health`, `/lt/*` do LanguageTool 6.8 (task 29, D58) i `/dict/*` do serwisu słownikowego (taski 25, 32 i 33, D61–D63) i `/classify` do klasyfikatora okładek (task 26, D68), a także realtime (task 90, D80): tylko `/rt/stream` **bez** `X-Tools-Secret` (strumień SSE `GET /rt/stream?token=…` z tokenem HMAC od aplikacji, `flush_interval -1`; reszta `/rt/*` → 401) i `/publish` z sekretem; usługi bez portu na zewnątrz. Serwis realtime to `docker/tools/realtime/server.mjs` (Node bez zależności, limit 64 MB) skopiowany do `content:` w `compose.yml` – po zmianie pliku trzeba przenieść kopię (test `realtime-service.test.ts` pilnuje zgodności i braku `$`). Zmienna usługi `APP_ORIGIN`: adresy aplikacji dla CORS, po przecinku (domyślnie `http://localhost:3000`); token jest ważny 10 min, a strumień kończy się z jego wygaśnięciem (strona odnawia go wcześniej). Limity serwisu: 10 strumieni na konto (najstarszy zamykany), 2000 łącznie (`MAX_STREAMS`, ponad limit 503 i strona wraca do pollingu), 500 kont na jedno `/publish` (aplikacja dzieli większe listy). Przy działającym strumieniu strona i tak odpytuje co 5 min na wypadek zgubionego zdarzenia. Klasyfikator przy pierwszym starcie instaluje pakiety Pythona i pobiera model ONNX (23,7 MB, sprawdzany SHA-256) do wolumenu `classifier-data`, więc jego healthcheck ma `start_period` 10 min; pamięć ok. 290 MiB po ocenie (pomiar lokalny 2026-11-09, limit 512 MB). Aplikacja: `COVERS_MAX_TOTAL_MB` (globalny limit okładek, domyślnie 200) i `COVERS_ADULT_THRESHOLD` (próg 18+, domyślnie 0,5) – ustawić na Vercelu po pomiarze danych w Atlasie i kalibracji progu (task 67; do tego czasu szacunek 150 MB w `.env.example`).

| Co | Adres |
| --- | --- |
| Panel Coolify | `http://localhost:8000` (realtime: 6001, 6002), login `admin@story-app.localhost`, hasło w `.tools/tools.env` |
| Bramka narzędzi | `http://127.0.0.1:8110` (`TOOLS_API_URL`) |
| LanguageTool | `http://127.0.0.1:8110/lt/v2/check` (z nagłówkiem `X-Tools-Secret`) |
| Realtime | `http://127.0.0.1:8110/rt/stream?token=…` (bez sekretu), `POST /publish` z `X-Tools-Secret`; w `.env.local` `REALTIME_PUBLIC_URL=http://127.0.0.1:8110` (dopisz ręcznie, `npm run up` go nie ustawia), aplikacja na `http://localhost:3000` |
| Serwis słownikowy | `POST http://127.0.0.1:8110/dict/lemmas`, `/dict/definitions`, `/dict/synonyms` i `/dict/rhymes` z `{"forms": [...]}` (`/rhymes` także z `keys` i opcjonalnymi `filters`), `GET /dict/health` (wersja i data budowy każdej bazy); z nagłówkiem `X-Tools-Secret` |

Wszystkie porty tylko na `127.0.0.1`. Projekt Compose ma stałą nazwę `story_app` (`name:` w `docker-compose.yml`), więc wolumeny i kontenery mają prefiks `story_app` niezależnie od nazwy katalogu.

Polecenia:

- `npm run up` – startuje wszystko (MongoDB, Coolify, serwer docelowy), zakłada konto admina, włącza API Coolify i tworzy token, dodaje klucz SSH, serwer, projekt i usługę, ustawia sekret, czeka na `/health`, rozgrzewa LanguageTool pierwszym polskim sprawdzeniem i dopisuje `TOOLS_API_URL` i `TOOLS_API_SECRET` do `.env.local`. Ponowne uruchomienie niczego nie duplikuje i nie zmienia sekretów (tworzy tylko nowy token API w miejsce starego).
- `npm run dict:build [forms|definitions|synonyms|rhymes]` – bez argumentu wszystkie bazy. `forms`: baza form `.tools/dict/forms.sqlite` (ok. 410 MB, ok. 1 min) z PoliMorfu; plik źródłowy pobiera raz do `.tools/dict/src/` i sprawdza sumę SHA-256. Nowe wydanie PoliMorfu: adres, wersja i suma w `scripts/dictionary.ts`. `definitions`: definicje `.tools/dict/definitions.sqlite` (ok. 40 MB, ok. 20 s) ze zrzutu Wikisłownika z kaikki.org (D62). Kaikki podaje tylko najnowszy zrzut, więc plik zapisywany jest jako `plwiktionary-RRRRMMDD.jsonl.gz` (data z `Last-Modified`), a budowa używa najnowszego zapisanego; `--refresh` pobiera aktualny. Wersja i suma SHA-256 pliku trafiają do `meta`. `synonyms`: synonimy `.tools/dict/synonyms.sqlite` (ok. 23 MB, ok. 16 s) z tego samego zrzutu i z tezaurusa Dobrego słownika (D63). Paczka `pl-dict-latest.oxt` (2,4 MB, wydanie kwartalne) zapisywana jest jak zrzut, jako `dobryslownik-RRRRMMDD.oxt`. Budowa przerywa pracę, gdy zmieniła się licencja lub linie copyright tezaurusa; wtedy trzeba poprawić `SOURCES` w `lib/tools/sources.ts`. Definicje i synonimy budowane razem czytają zrzut raz; `--refresh` zawsze przebudowuje obie, żeby miały tę samą wersję zrzutu. `rhymes`: rymy `.tools/dict/rhymes.sqlite` (ok. 730 MB, ok. 2,5 min) z gotowej bazy form i listy częstości wordfreq 3.2 (2,4 MB, pobierana raz i sprawdzana sumą SHA-256, D64). Po przebudowie bazy form trzeba przebudować i wgrać też rymy, bo przechowują id lematów tej bazy.
- `npm run dict:upload [forms|definitions|synonyms|rhymes]` – wysyła zbudowane pliki (bez argumentu wszystkie) do serwisu słownikowego (strumieniem do krótkiego kontenera z wolumenem `dict-data` w serwerze docelowym, bo zapis 413 MB w kontenerze serwisu przekracza jego limit 128 MB i kończy się OOM; zamiana przez `mv` dopiero po zgodności rozmiaru, więc przerwane wgranie zostawia starą bazę) i sprawdza w `/dict/health`, że serwis podaje nową datę budowy. Serwis otwiera plik od nowa po zmianie i-węzła, więc restart nie jest potrzebny. Do czasu pierwszego wgrania bazy form serwis odpowiada 503, a Coolify pokazuje go jako `unhealthy`; bez bazy definicji, synonimów lub rymów 503 daje tylko jej trasa. Zmiana kodu serwisu w `compose.yml` dochodzi do serwera przez `npm run up` (aktualizacja plików `content:` przez API storages Coolify). Gdy nowy kod serwisu czyta nowe kolumny bazy (np. filtry rymów, D65), najpierw trzeba wgrać bazę, potem `npm run up`.
- `npm run down` – `docker compose --profile tools down`: zatrzymuje i usuwa kontenery (także `mongo`), wolumeny zostają.
- `npm run db:up`, `npm test`, `npm run test:e2e` startują tylko `mongo`.

Pliki z `.gitignore` w `.tools/` (prawa 600, katalog 700): `coolify.env` (`APP_KEY`, hasła Postgresa i Redisa, `PUSHER_*`; nie zmieniać po pierwszym starcie), `tools.env` (login i hasło admina, `TOOLS_API_SECRET`), `ssh/id_ed25519` (klucz Coolify do serwera docelowego). Skrypt (`scripts/tools.ts`) nie wypisuje sekretów ani treści odpowiedzi API.

Konto admina, przełącznik API i token zakłada skrypt przez `php artisan tinker` w kontenerze, bo seeder Coolify (`ROOT_USER_*`) wymaga e-maila z rekordem DNS i sprawdza hasło w HaveIBeenPwned, a przy błędzie tylko loguje.

Uwagi:

- Wbudowany serwer `localhost` (`host.docker.internal`) jest nieosiągalny: Coolify nie ma do niego klucza (brak `PrivateKey` 0), a my nie dajemy SSH do hosta. Nic na nim nie wdrażamy. Skutek w logach: przy starcie `StartProxy … FAIL`, a co minutę `CheckAndStartSentinelJob … FAIL` i w `storage/logs/laravel.log` ostrzeżenia `ServerConnectionCheck: Server not reachable` dla `localhost` – do zignorowania.
- Zmiana `docker/tools/compose.yml`: `npm run up` wysyła nowy `docker_compose_raw` i restartuje usługę, gdy plik różni się od ostatnio wdrożonego (hash w `.tools/deployed-compose.sha256`). Coolify zapisuje plik z `content:` tylko wtedy, gdy go nie ma na serwerze, więc `scripts/tools.ts` porównuje treść każdego pliku `content:` (Caddyfile, kod serwisów) z zapisaną w Coolify (API storages, dopasowanie po `target`), zmienioną wysyła `PATCH`, czeka, aż trafi na serwer, i restartuje usługę. Nazwa źródła się nie zmienia. `target` musi być unikalny we wszystkich usługach (dlatego realtime ma `/app/realtime.mjs`, a nie `/app/server.mjs` jak serwis słownikowy).
- Baza słownika leży na wolumenie usługi (`<uuid>_dict-data` w serwerze docelowym). Usunięcie usługi w Coolify może usunąć jej wolumeny; wtedy po `npm run up` trzeba ponownie `npm run dict:upload`.
- Błąd walidacji serwera (np. brak `git`, `curl`, `jq` w obrazie) zostaje w Coolify; po poprawce trzeba kliknąć Validate przy serwerze w panelu albo zresetować środowisko.
- Zasoby (pomiar 2026-11-06, po sprawdzeniu rozdziału): Coolify ok. 430 MB, Postgres 43 MB, Redis 13 MB, serwer docelowy 740 MB (w tym LanguageTool ok. 490 MB z limitem 800 MB, bramka 14 MB), razem ok. 1,2 GB bez MongoDB. Serwis słownikowy (2026-11-06): ok. 17–25 MB przy limicie 128 MB, baza 413 MB na dysku. Obrazy ok. 1,4 GB na hoście i 1,35 GB w DinD (LanguageTool 0,75 GB).

Wymiana `TOOLS_API_SECRET`: wpisz nową wartość w `.tools/tools.env` (`openssl rand -hex 32`), potem `npm run up` – ustawi zmienną w Coolify, zrestartuje usługę i zaktualizuje `.env.local`.

Reset środowiska narzędzi (bez ruszania danych MongoDB):

```sh
npm run down
docker volume rm story_app_coolify-db story_app_coolify-redis story_app_coolify-storage \
  story_app_tools-server-data story_app_tools-server-docker
rm -rf .tools
npm run up
```

Reset generuje nowe sekrety i nowe hasło admina. Usuwać zawsze razem wolumeny i `.tools/`: same `.tools/` przy starych wolumenach daje Coolify nowe `APP_KEY` i hasła niezgodne z bazą, a same `.tools/ssh` – klucz niezgodny z zapisanym w Coolify. Nie używać `docker compose down -v`: usunęłoby też wolumen `mongo-data` z lokalną bazą.

## Serwer narzędzi na Mikrusie (task 28)

Produkcyjny odpowiednik lokalnego serwera narzędzi: ten sam stos (Coolify 4.6.0, bramka Caddy z `X-Tools-Secret`, LanguageTool, serwis słownikowy), ale Coolify stoi na samym VPS-ie i wdraża usługę na własny host (serwer `localhost` z instalatora). Wszystko robi `npm run tools:remote` z Twojego komputera przez SSH, a bazy wysyła `npm run dict:upload:remote`. Produkcja i staging używają jednego serwera i jednego sekretu.

Skrypt sprawdzony na „fałszywym Mikrusie” (kontener Debian 13 z systemd i SSH, wcześniej też Ubuntu 24.04, profil `fake-mikrus` w `docker-compose.yml`). Na prawdziwym Mikrusie nie sprawdzono jeszcze: Dockera i Coolify w kontenerze LXC, `wykr.es` przed bramką, opóźnienia z Vercela i restartu maszyny. To kryteria taska 28 do odhaczenia przy pierwszym wdrożeniu.

### Pierwsze wdrożenie

1. **Zakup:** Mikrus 3.5 (4 GB RAM, 40 GB dysku) na [mikr.us](https://mikr.us/). Z maila zapisz nazwę serwera (`srvNN`) i numer ID.
2. **System Debian 13:** nowy serwer dostaje Ubuntu, więc w panelu Mój VPS → [Reinstalacja](https://mikr.us/panel/?a=reinstall) wybierz **Debian 13** (reinstalacja usuwa dane, na świeżym serwerze nie ma czego tracić). Zapisz hasło roota po reinstalacji. Obraz Mikrusa jest z 2025.09, więc po kroku 4 zaktualizuj system: `ssh -p 10ID root@srvNN.mikr.us 'apt-get update && apt-get -y full-upgrade && reboot'`.
3. **Porty** (bez klikania w panelu): SSH to `10000+ID`, bramka dostaje domyślny port z puli `20000+ID`. Publiczny adres bramki to `https://srvNN-20ID.wykr.es` (np. ID 123 → `srv12-20123.wykr.es`). Subdomena `wykr.es` działa sama, a SSL zapewnia Mikrus.
4. **Klucz SSH** (raz, z hasłem roota z kroku 2): `ssh-copy-id -p 10ID root@srvNN.mikr.us`. Potem sprawdź logowanie bez hasła: `ssh -p 10ID root@srvNN.mikr.us true`.
5. **Konfiguracja:** utwórz `.tools/mikrus/remote.env` (katalog w `.gitignore`):
   ```sh
   SSH_HOST=srvNN.mikr.us
   SSH_PORT=10ID
   GATEWAY_PORT=20ID
   TOOLS_API_URL=https://srvNN-20ID.wykr.es
   # SSH_USER=root (domyślnie), SSH_KEY=ścieżka do klucza, jeśli nie ten z ~/.ssh
   ```
6. **Instalacja i wdrożenie:** `npm run tools:remote`. Pierwszy raz trwa ok. 15–25 min (Docker, Coolify, obraz LanguageTool 0,75 GB). Skrypt:
   - zapisuje `docker/mikrus/docker-compose.custom.yml` jako override Coolify, więc panel (8000, 6001, 6002) słucha tylko na `127.0.0.1`;
   - instaluje Dockera (skryptem Mikrusa `chce_dockera.sh`, gdy jest) i Coolify w wersji 4.6.0;
   - przez tunel SSH zakłada konto admina, wyłącza rejestrację i automatyczne aktualizacje, tworzy token API;
   - wyłącza proxy (Traefik) na serwerze `localhost`;
   - wdraża usługę `story-app-tools` z `docker/tools/compose.yml` z `GATEWAY_PORT` i sekretem;
   - czeka na `/health` i rozgrzewa LanguageTool przez publiczny adres.

   Sekrety (hasło admina, `TOOLS_API_SECRET`) skrypt generuje w `.tools/mikrus/tools.env` i nigdy ich nie wypisuje. Na końcu podaje, co ustawić na Vercelu.
7. **Bazy słownikowe:** `npm run dict:build` (jeśli nie ma ich w `.tools/dict/`), potem `npm run dict:upload:remote`. Wysyłka idzie przez SSH z kompresją (ok. 1,2 GB, w tym rymy ok. 730 MB). Przerwana wysyłka zostawia starą bazę, więc wystarczy ją powtórzyć. Kolejność przy zmianie schematu bazy: najpierw baza, potem `npm run tools:remote` (D65).
8. **Vercel:** Settings → Environment Variables, tylko po stronie serwera (bez `NEXT_PUBLIC_`), dla **Production** oraz **Preview z branchem `staging`**:
   - `TOOLS_API_URL` = `https://srvNN-20ID.wykr.es`
   - `TOOLS_API_SECRET` = wartość `TOOLS_API_SECRET` z `.tools/mikrus/tools.env`

   - `REALTIME_PUBLIC_URL` = `https://srvNN-20ID.wykr.es` (task 90; musi być `https`, bo strona z Vercela nie połączy się z `http`; trafia też do `connect-src` CSP)

   W panelu Coolify (tunel `ssh -p 10ID -L 8000:127.0.0.1:8000 root@srvNN.mikr.us`, usługa `story-app-tools` → Environment Variables) ustaw `APP_ORIGIN` = adres produkcji i stagingu po przecinku, np. `https://<domena produkcji>,https://story-app-git-staging-iicytowers-projects.vercel.app`, i zrestartuj usługę. `npm run tools:remote` tej zmiennej nie nadpisuje.

   Potem Redeploy obu środowisk. Bez tych zmiennych narzędzia pokazują „not available” (D56), a powiadomienia i wiadomości działają pollingiem.
9. **Sprawdzenie** (kryteria taska 28):
   ```sh
   URL=https://srvNN-20ID.wykr.es
   set -a; source <(grep TOOLS_API_SECRET .tools/mikrus/tools.env); set +a
   curl -s -o /dev/null -w "%{http_code}\n" "$URL/health"                                         # 401
   curl -s -o /dev/null -w "%{http_code}\n" -H "X-Tools-Secret: $TOOLS_API_SECRET" "$URL/health"  # 200
   curl -s -H "X-Tools-Secret: $TOOLS_API_SECRET" "$URL/dict/health"                               # daty baz
   curl -s -o /dev/null -w "%{time_total}\n" -H "X-Tools-Secret: $TOOLS_API_SECRET" "$URL/health" # opóźnienie
   curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL/publish"                                # 401
   curl -s -o /dev/null -w "%{http_code}\n" "$URL/rt/stream?token=x"                              # 401
   curl -s -i -H "Origin: https://<domena produkcji>" "$URL/rt/stream?token=x" | grep -i access-control  # adres z APP_ORIGIN
   ssh -p 10ID root@srvNN.mikr.us 'ip -6 addr show scope global'    # adres IPv6 serwera
   curl -g -s -m 5 -o /dev/null -w "%{http_code}\n" "http://[IPv6]:20ID/health"   # 401
   curl -g -s -m 5 "http://[IPv6]:8000" || echo "panel niedostępny – dobrze"
   ```
   Restart: `ssh -p 10ID root@srvNN.mikr.us reboot`, potem `/health` z sekretem znowu daje 200 (usługi mają `restart: unless-stopped`; na fałszywym Mikrusie po ok. 10 s). LanguageTool przez pierwsze kilkadziesiąt sekund odpowiada 502, a aplikacja pokazuje wtedy „not available”. Na końcu smoke test narzędzi na stagingu (sekcja „Smoke test”, kroki 7–8).

### Obsługa

- **Panel Coolify:** `ssh -N -L 8000:127.0.0.1:8000 -p 10ID root@srvNN.mikr.us`, potem `http://localhost:8000`. Login `admin@story-app.localhost`, hasło w `.tools/mikrus/tools.env`.
- **Zmiana `docker/tools/compose.yml` lub Caddyfile:** `npm run tools:remote` (idempotentny; restartuje usługę, gdy plik się zmienił, jak lokalnie).
- **Wymiana sekretu:** nowa wartość `TOOLS_API_SECRET` w `.tools/mikrus/tools.env` (`openssl rand -hex 32`), `npm run tools:remote`, potem ta sama wartość na Vercelu (Production i Preview `staging`) i Redeploy. Do czasu Redeployu narzędzia odpowiadają 401, a aplikacja pokazuje „not available”.
- **Logi:** `ssh -p 10ID root@srvNN.mikr.us 'docker ps --format "{{.Names}} {{.Status}}"'`, potem `docker logs --tail 100 <nazwa>`.
- **Aktualizacja Coolify:** automatyczne aktualizacje są wyłączone. Nową wersję trzeba najpierw sprawdzić lokalnie (obraz w `docker-compose.yml`), potem zmienić `COOLIFY_VERSION` w `scripts/tools.ts` i na serwerze uruchomić `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash -s <wersja>`.
- **Kopia `.tools/mikrus/` i `/data/coolify/source/.env` z serwera** (klucze Coolify, instalator o to prosi): trzymaj je w menedżerze haseł. Bez `tools.env` skrypt wygeneruje nowe hasło admina i nowy sekret (wtedy trzeba zmienić Vercel), a stare konto admina zostanie z dawnym hasłem.
- **Bazy po przebudowie formy:** przebuduj i wgraj też rymy (przechowują id lematów).

### Problemy

- **Docker nie startuje w LXC:** na Mikrusie uruchom `cd /opt/noobs/scripts && ./chce_dockera.sh`, potem ponownie `npm run tools:remote`.
- **„toomanyrequests” z Docker Huba:** polecenie Mikrusa `docker_proxy` na serwerze, potem ponownie `npm run tools:remote`.
- **Walidacja serwera w Coolify:** błąd z `validation_logs` pokazuje skrypt. Po poprawce użyj Validate przy serwerze `localhost` w panelu albo uruchom skrypt ponownie.
- **`wykr.es` nie odpowiada:** sprawdź bramkę na serwerze: `ssh … 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:20ID/health'` (401 = bramka działa, problem po stronie subdomeny). Nie wiadomo jeszcze, czy proxy `wykr.es` mówi do portu po HTTP (tak zakładamy).
- **Zmiana klucza hosta SSH** (np. reinstalacja systemu): usuń `.tools/mikrus/known_hosts`.

### Test na fałszywym Mikrusie

```sh
mkdir -p -m 700 .tools/fake-mikrus
ssh-keygen -q -t ed25519 -N '' -f .tools/fake-mikrus/id_ed25519
printf 'SSH_HOST=127.0.0.1\nSSH_PORT=10022\nSSH_KEY=.tools/fake-mikrus/id_ed25519\nGATEWAY_PORT=20110\nTOOLS_API_URL=http://127.0.0.1:20110\n' > .tools/fake-mikrus/remote.env
docker compose --profile fake-mikrus up -d --build fake-mikrus
TOOLS_REMOTE_DIR=.tools/fake-mikrus npm run tools:remote
TOOLS_REMOTE_DIR=.tools/fake-mikrus npm run dict:upload:remote
```

Kontener ma systemd i nie ma Dockera, jak świeży VPS (potrzebuje `privileged` i `cgroup: host`). Wolumen `/var/lib/containerd` jest potrzebny, bo Docker 29 trzyma tam obrazy, a na overlayu kontenera ich warstwy się nie rozpakowują (na LXC Mikrusa tego problemu nie ma). Wynik na Ubuntu 24.04 (2026-11-06): pierwsze `npm run tools:remote` ok. 6 min, kolejne 36 s; `dict:upload:remote` 83 s. Na Debianie 13 (2026-11-09, obrazy w cache): 137 s, 34 s, 51 s, bramka po restarcie po 15 s. W obu przypadkach po restarcie kontenera wszystko wstaje samo, bez Traefika; panel tylko na `127.0.0.1`. Usunięcie: `docker compose --profile fake-mikrus down` i `docker volume rm story_app_fake-mikrus-docker story_app_fake-mikrus-containerd story_app_fake-mikrus-data`, potem `rm .tools/fake-mikrus/known_hosts` (nowe klucze hosta).
