# 90 – Realtime: serwis SSE w stosie narzędzi

Subtask 68, zależy od 81 i 85. Podstawa: D80 (Powiadomienia, DM, realtime – realtime). Branch `feature/90-realtime` z `feature/social`, merge do `feature/social`.

## Zakres

- Usługa `realtime` w `docker/tools/compose.yml`: Node (oficjalny obraz `node` z przypiętą wersją), jeden plik `docker/tools/realtime/server.mjs` bez zależności (`node:http`, `node:crypto`), limit pamięci i healthcheck. Endpointy: `GET /rt/stream?token=…` (SSE, `text/event-stream`, heartbeat co 25 s, kanał = `userId` z tokenu) i `POST /publish` (`{ userIds, event }`, tylko z `X-Tools-Secret`).
- Bramka Caddy: `handle_path /rt/*` bez `X-Tools-Secret` (z `flush_interval -1`), `/publish` w bloku z sekretem. Serwis odpowiada `Access-Control-Allow-Origin: <APP_ORIGIN>` (adres aplikacji, zmienna usługi); `REALTIME_PUBLIC_URL` to adres bramki, do `connect-src` CSP.
- Token: HMAC-SHA-256 z kluczem wyprowadzonym z `TOOLS_API_SECRET` (`userId`, `exp` 10 min), wydawany akcją `realtimeToken()` (sesja wymagana); klient odnawia przed wygaśnięciem.
- Aplikacja: `publishRealtime(userIds, event)` w `notify()` (81) i `sendMessage` (85), w `after()`, błąd tylko w logach. Zmienna `REALTIME_PUBLIC_URL` (publiczny adres bramki) – bez niej klient używa tylko pollingu; dopisana do `connect-src` w `lib/security-headers.ts` (D77).
- Klient: `EventSource` przy widocznej karcie; zdarzenie odświeża licznik i otwartą rozmowę. Przy błędzie lub braku zmiennej – polling z 81/85 (30 s / 5 s). Przy działającym SSE polling wstrzymany.
- E2E: `tests/e2e/fake-tools.mjs` dostaje `/rt/stream` i `/publish` (atrapa SSE). Lokalnie usługa w `npm run up`, zgodna z `npm run tools:remote` (task 28) bez zmian skryptu poza listą usług; `docs/deploy.md`: zmienne, ścieżka `/rt/*`, wymaganie przed wydaniem.

## Kryteria akceptacji

1. Usługa startuje w `npm run up`, healthcheck przechodzi, `/publish` bez sekretu → 401.
2. Strumień bez tokenu, z błędnym lub wygasłym tokenem → 401; z poprawnym dostaje tylko zdarzenia swojego `userId`.
3. Nowe powiadomienie i nowa wiadomość docierają do otwartej karty bez czekania na polling.
4. Bez `REALTIME_PUBLIC_URL` albo przy niedostępnej usłudze działa polling.
5. CSP pozwala na połączenie tylko z `REALTIME_PUBLIC_URL`.
6. Dokumentacja wdrożenia zaktualizowana.

## Testy

- Unit: `lib/social/realtime-token.test.ts` (podpis, wygaśnięcie), `lib/security-headers.test.ts` (5).
- Integracyjne: `tests/integration/realtime-service.test.ts` (uruchamia `server.mjs` jako proces: 1 bez Dockera, 2).
- E2E: `tests/e2e/realtime.spec.ts` (3 z atrapą SSE: `dave` pisze, `erin` widzi bez przesuwania zegara; 4 – atrapa wyłączona, polling z `page.clock`).
- `manual`: 1 na lokalnym stosie (`npm run up`) i na fałszywym Mikrusie (profil `fake-mikrus`, `npm run tools:remote` na niego); 6 – przegląd `docs/deploy.md`.
