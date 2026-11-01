# 28 – Serwer na Mikrusie

Wynik researchu (2026-11-01). Serwer dla LanguageTool (29) i serwisu słownikowego (25). Konfigurację u dostawcy robi użytkownik, a repo dostaje opis w `docs/deploy.md`.

## Zakres

- Mikrus 3.5 (4 GB RAM, 40 GB dysku, 197 zł/rok) z Coolify.
- Reverse proxy wymagające sekretnego nagłówka przed wszystkimi usługami.
- Połączenie z Vercela przez subdomenę `wykr.es` z automatycznym HTTPS.
- Zmienne `TOOLS_API_URL` i `TOOLS_API_SECRET` na Vercelu i lokalnie, tylko po stronie serwera.

## Ustalenia

- Plan 3.5 zamiast 2.1, bo Coolify ma własne wymagania (decyzja użytkownika). Zmienia koszt z researchu.
- Serwer nie ma własnego IPv4, a `wykr.es` korzysta z portu z puli IPv4.
- Wynikiem taska jest działający endpoint testowy, bez usług docelowych.

Do sprawdzenia na początku, bo od tego zależy reszta:

- Czy Docker i Coolify działają na Mikrusie oraz czy Coolify zgadza się z portem z puli. Jeśli nie, usługi działają bez Coolify.
- Czy funkcja Vercela dociera do `wykr.es` i jakie jest opóźnienie.
- Jeden sekret na produkcję i staging czy dwa.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Mikrus (stan z [mikr.us](https://mikr.us/) i wiki, 2026-11-01)

| Plan | RAM | Dysk | Cena/rok |
| --- | --- | --- | --- |
| 2.1 | 1 GB | 10 GB | 75 zł |
| 3.0 | 2 GB | 25 GB | 130 zł |
| 3.5 | 4 GB | 40 GB | 197 zł |
| 4.1 PRO | 8 GB | 80 GB | 395 zł |

Serwery w Finlandii, ceny brutto bez promocji. Moc CPU jest przydzielana dynamicznie, bez gwarancji, a przy długim obciążeniu może zostać przycięta (plany PRO 4.1 i 4.2 mają 2× większy limit). Liczby vCPU dla planu 3.5 strona nie podaje.

- [Porty](https://wiki.mikr.us/udostepnione_porty): trzy domyślne na współdzielonym IPv4 (10000+ID dla SSH, 20000+ID, 30000+ID), dodatkowe w panelu Sieć i domeny → Porty TCP IPv4: 5, na 3.5 **10**. Na IPv6 i wewnątrz serwera bez limitu.
- [Subdomeny](https://wiki.mikr.us/darmowa_subdomena_dla_vps): `serwer-port.wykr.es` (np. `srv55-30999.wykr.es`) tylko dla portów z puli, HTTP i HTTPS. `serwer-port.mikrus.cloud` i własne subdomeny wymagają nasłuchu na IPv6 (`[::]:8000`). SSL automatyczny, bez certbota.
- [Szybka subdomena](https://wiki.mikr.us/szybka_subdomena): `domena 555` albo `domena nazwa.byst.re 1234`, też byst.re, bieda.it, toadres.pl. Aplikacja musi już odpowiadać, a 50x blokuje utworzenie.
- [Tunel Cloudflare](https://wiki.mikr.us/podpiecie_domeny_przez_tunel_cloudflare) wymaga domeny, a użytkownik jej nie ma.
- Do sprawdzenia na Mikrusie: czy `wykr.es` działa z portem kierowanym wprost na bramkę. W sandboksie przy domenie `http://` Traefik nie próbował wystawiać certyfikatu.

### Coolify

[Dokumentacja](https://coolify.io/docs/get-started/installation): minimum 2 rdzenie, 2 GB RAM, 30 GB dysku (nowsza wersja dokumentacji podaje 10 GB). Sam zajmuje ok. 300–400 MB. Buildy mocno obciążają CPU, więc obrazy lepiej pobierać gotowe. Wymaga Dockera; nie sprawdzono, czy działa w kontenerze Mikrusa.

### Bezpieczeństwo

Serwer LanguageTool nie ma uwierzytelniania, więc bez proxy z sekretem każdy może z niego korzystać. W teście działał osobny Caddy, sprawdzający nagłówek `X-Tools-Secret`. Usługi nie mogą nasłuchiwać bezpośrednio na IPv6 ani porcie z puli.

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

**[wniosek]** Port z puli kierować bezpośrednio na bramkę, z pominięciem Traefika. Sprawdzono to tylko symulacją, nie przez prawdziwe `wykr.es`.

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

- Tworzenie przez API: `POST /api/v1/projects`, `POST /api/v1/services` (`docker_compose_raw` w base64, `instant_deploy: false`, `urls`), `PATCH /services/{uuid}/envs`, potem `POST /services/{uuid}/start`. `/api/health` działa bez tokena, reszta wymaga tokena z zakładki Keys & Tokens. Specyfikacja API jest w kontenerze: `/var/www/html/openapi.yaml`.
- Adres `http://tools.localhost:8080` w `urls` daje domenę `http://tools.localhost` i etykietę portu kontenera 8080.
- Plik z `content:` zapisuje się tylko raz. `PATCH` na `docker_compose_raw` go nie zmienia, choć inne zmiany z compose, np. porty, wchodzą. Plik zmienia się przez `PATCH /services/{uuid}/storages`, a usługę trzeba zrestartować.
- Tuż po `restart` odpowiadają jeszcze stare kontenery, więc sprawdzanie od razu pokazuje starą konfigurację.
- Traefik ma `--ping.entrypoint=http`, więc przejmuje ścieżkę `/ping` na każdej domenie. Dlatego bramka używa `/health`.
- Status usługi to `running:unknown`, bo bramka i atrapa nie mają healthchecku.
- Sekret leży na serwerze w `/data/coolify/services/<uuid>/.env` z prawami 0644.
- Traefik publikuje `80`, `443` i `8080`, także na `[::]`.

Nie potwierdzono w sandboksie: działania Dockera i Coolify w kontenerze Mikrusa, prawdziwego portu z puli i `wykr.es` z ich TLS, opóźnienia Vercel → Finlandia, restartu prawdziwej maszyny oraz braku ekspozycji po IPv6 panelu `:8000` i Traefika.

Użyty compose. Port 20123 jest testowy, `TOOLS_API_SECRET` to zmienna usługi w Coolify, a obraz LT trzeba przypiąć do wersji. Usługa `dictionary` to atrapa:

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

### Odrzucone hostingi (ceny [do weryfikacji])

| Hosting | Koszt | Uwagi |
| --- | --- | --- |
| Hetzner Cloud CX23 / CAX11 | ~4–4,50 €/mies. netto | ma IPv4, podwyżki w 2026 |
| Google Cloud Run | ~0 zł w limicie | zimny start kilka–kilkanaście sekund, konto rozliczeniowe |
| Fly.io 1 GB | ~6,70 $/mies. | RAM podrożał 2026-10-01 |
| Railway 1 GB | ~10 $/mies. | plan Hobby 5 $ |
| Oracle Always Free | 0 | dostępność, ryzyko usunięcia instancji |

Ceny Mikrusa 3.5 zastępują pierwotny wybór 2.1 za 75 zł.

## Kryteria akceptacji

1. Żądanie ze stagingu Vercela przechodzi przez HTTPS do serwera.
2. Żądanie bez sekretu dostaje odmowę, także na porcie i na adresie IPv6, a usługi nie są dostępne poza proxy.
3. Sekret i adres są tylko w zmiennych serwerowych.
4. Usługi wstają same po restarcie serwera.
5. `docs/deploy.md` opisuje serwer, zmienne, wgrywanie bazy i wymianę sekretu.

## Testy

Bez testów automatycznych: to infrastruktura, a testy aplikacji nie łączą się z siecią. `manual`: wszystkie kryteria, z odnotowanym wynikiem i opóźnieniem.
