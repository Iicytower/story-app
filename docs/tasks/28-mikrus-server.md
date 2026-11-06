# 28 – Serwer na Mikrusie

Wynik researchu (2026-11-01), zmieniony 2026-11-06 (D56). Prawdziwy serwer dla usług, które do tego czasu działają lokalnie w Dockerze (task 54): bramki, LanguageTool (29) i serwisu słownikowego (25). Konfigurację u dostawcy robi użytkownik, a repo dostaje opis w `docs/deploy.md`.

## Zakres

- Mikrus 3.5 (4 GB RAM, 40 GB dysku, 197 zł/rok) z Coolify.
- Ten sam stos co lokalnie (task 54): bramka z sekretnym nagłówkiem przed wszystkimi usługami oraz usługi gotowe w chwili realizacji (LT, serwis słownikowy z bazą).
- Połączenie z Vercela przez subdomenę `wykr.es` z automatycznym HTTPS.
- Zmienne `TOOLS_API_URL` i `TOOLS_API_SECRET` na Vercelu (produkcja, staging), tylko po stronie serwera. Ich ustawienie włącza narzędzia (D56).
- Ponowne pomiary na Mikrusie: limity czasu LT (29) i RAM całego stosu (25).

## Ustalenia

- Plan 3.5 zamiast 2.1, bo Coolify ma własne wymagania (decyzja użytkownika). Zmienia koszt z researchu.
- Serwer nie ma własnego IPv4, a `wykr.es` korzysta z portu z puli IPv4.
- Task na końcu kolejki, po tasku 54 i narzędziach z niego korzystających (decyzja użytkownika, D56).

Do sprawdzenia na początku, bo od tego zależy reszta:

- Czy Docker i Coolify działają na Mikrusie oraz czy Coolify zgadza się z portem z puli. Jeśli nie, usługi działają bez Coolify.
- Czy funkcja Vercela dociera do `wykr.es` i jakie jest opóźnienie.
- Jeden sekret na produkcję i staging czy dwa.

### Przygotowanie przed zakupem (2026-11-06)

Decyzje użytkownika: Coolify na Mikrusie jak lokalnie, bazy budowane lokalnie i wysyłane przez SSH, jeden sekret dla produkcji i stagingu.

- `npm run tools:remote` (`scripts/tools.ts`, `scripts/remote.ts`): przez SSH instaluje Dockera i Coolify 4.6.0 z overridem panelu na `127.0.0.1` (`docker/mikrus/docker-compose.custom.yml`), zakłada admina i token przez tinker (sekrety przez stdin), wyłącza rejestrację, automatyczne aktualizacje i Traefika, wdraża usługę na serwer `localhost` Coolify z `GATEWAY_PORT` z puli i czeka na LanguageTool przez publiczny adres. Konfiguracja w `.tools/mikrus/remote.env`.
- `npm run dict:upload:remote`: ta sama wysyłka co lokalnie, przez `ssh -C`.
- Instrukcja krok po kroku: `docs/deploy.md`, „Serwer narzędzi na Mikrusie”.
- Test na `fake-mikrus` (Ubuntu 24.04 z systemd w Dockerze): instalacja, idempotencja, wysyłka baz, 401 bez sekretu, panel tylko na loopbacku, restart. Na prawdziwym Mikrusie zostają wszystkie kryteria akceptacji.

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

### Coolify i bramka

Konfiguracja Coolify, bramki i wyniki testu w lokalnej instancji: task 54. Na Mikrusie powtarzamy ten sam stos. Wymagania Coolify: minimum 2 rdzenie, 2 GB RAM, 30 GB dysku (nowsza wersja dokumentacji podaje 10 GB), sam zajmuje ok. 300–400 MB. Nie sprawdzono, czy Docker i Coolify działają w kontenerze Mikrusa.

Z lokalnego testu **[wniosek]**: port z puli kierować bezpośrednio na bramkę, z pominięciem Traefika. Sprawdzono to tylko symulacją nagłówków `wykr.es`.

Nie potwierdzono lokalnie:

- działania Dockera i Coolify w kontenerze Mikrusa;
- prawdziwego portu z puli i `wykr.es` z ich TLS;
- opóźnienia Vercel → Finlandia;
- restartu prawdziwej maszyny;
- braku ekspozycji panelu `:8000` i Traefika po IPv6.

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
6. Po ustawieniu zmiennych na stagingu narzędzia działają tam bez zmian w kodzie (D56).

## Testy

Bez testów automatycznych: to infrastruktura, a testy aplikacji nie łączą się z siecią. `manual`: wszystkie kryteria, z odnotowanym wynikiem i opóźnieniem.
