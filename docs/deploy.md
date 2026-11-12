# Wdrożenie

## Pozostałe części

- [Migracje](deploy/migrations.md) – mechanizm w buildzie, odtwarzanie z kopii, blokada, okno builda, uwagi do konkretnych wydań.
- [Serwer narzędzi](deploy/tools.md) – lokalny stos (Coolify, `npm run up`) i serwer na Mikrusie (`npm run tools:remote`: pierwsze wdrożenie, obsługa, problemy, fałszywy Mikrus, realtime).
- [Backup bazy](deploy/backup.md) – `scripts/backup.sh` i odtwarzanie.

## Środowiska

| Środowisko | Branch | Vercel | Baza (Atlas, ten sam klaster) |
| --- | --- | --- | --- |
| Produkcja | `main` | Production | `story-app` |
| Staging | `staging` | Preview, zmienne przypięte do brancha `staging` | `story-app-staging` |
| Lokalnie | dowolny | – | Docker, `story_app` (`npm run db:up` albo `npm run up`) |

- Vercel: Settings → Environment Variables → `MONGODB_URI` i `AUTH_SECRET` dla **Preview** z wybranym branchem `staging`. Inny `AUTH_SECRET` niż na produkcji. URI różni się od produkcyjnego tylko nazwą bazy (`.../story-app-staging?...`).
- Limity po adresie (task 57, D74): na Vercelu adres z `x-vercel-forwarded-for`, nic do ustawienia. Poza Vercelem `TRUSTED_IP_HEADER` musi wskazywać nagłówek ustawiany przez proxy (którego klient nie podrobi), inaczej limity po adresie są wyłączone (zostaje limit logowania po koncie).
- Preview innych branchy (`feature/*`) nie dostaje zmiennych, więc nie łączy się z żadną bazą.
- Stały adres stagingu: branch URL `story-app-git-staging-iicytowers-projects.vercel.app` (nie URL-e deploymentów z hashem).
- Konto na stagingu: `MONGODB_URI='mongodb+srv://.../story-app-staging?...' npm run create-account` (niepotrzebne, jeśli baza zaimportowana z produkcji).

## Stan stagingu (2026-10-20)

- [x] Baza `story-app-staging` w Atlasie, dane zaimportowane z produkcji.
- [x] Vercel → Environment Variables: `MONGODB_URI` i własny `AUTH_SECRET` dla Preview, branch `staging`.
- [x] Adres: `story-app-git-staging-iicytowers-projects.vercel.app` (branch URL Vercela, za Deployment Protection).
- [x] Smoke test na stagingu.

## Wydanie

1. Taski zmergowane do `develop`, potem `develop` → `staging` i smoke test na stagingu.
2. Merge `staging` → `main` robi użytkownik (nigdy push na `main` z lokalnego repo), potem tag `vX.Y.Z` → deploy produkcji.
3. Rollback: „Promote” poprzedniego deploymentu w Vercelu.

- **Wydanie systemu społecznościowego (`feature/social`, taski 68–91, D80):** kolejność: (1) backup bazy (`scripts/backup.sh`); (2) serwer narzędzi z usługą `realtime` wdrożony przed merge'em do `staging`/`main` (`npm run tools:remote`, punkt niżej), w Coolify zmienna usługi `APP_ORIGIN` z adresami aplikacji (produkcja i staging, CORS strumienia) – bez tego aplikacja działa, ale tylko pollingiem; (3) na Vercelu (Production i Preview `staging`) `REALTIME_PUBLIC_URL` (opcjonalnie; poza tym bez nowych zmiennych – `TOOLS_API_URL` i `TOOLS_API_SECRET` jak dotąd, avatary i okładki używają tego samego klasyfikatora); (4) merge – build uruchamia migrację `008-forum-categories` (kolekcja `forumCategories` z kategoriami startowymi, bez kopii, indeksy nowych kolekcji przez `syncIndexes()`; w logu `Applying 008-forum-categories`); (5) po wejściu deploymentu rola admina: `npm run admin -- add <nick>` na właściwej bazie (punkt w „Ustalenia”).
- **Wydanie z taskiem 90 (realtime, D80):** wymaga serwera narzędzi na produkcji. Przed wydaniem `npm run tools:remote` (usługa `realtime` i trasy `/rt/stream`, `/publish` w bramce), w Coolify zmienna usługi `APP_ORIGIN` z adresami aplikacji, na Vercelu `REALTIME_PUBLIC_URL` ([`deploy/tools.md`](deploy/tools.md), „Serwer narzędzi na Mikrusie”, kroki 8–9). Bez `REALTIME_PUBLIC_URL` albo przy niedziałającej usłudze liczniki i rozmowy działają pollingiem (30 s / 5 s).
- **Wydanie z taskiem 70 (avatary):** przed wydaniem przebuduj i ponownie wdróż stos narzędzi (lokalnie `npm run up`, na Mikrusie `npm run tools:remote`), bo klasyfikator z `docker/tools/compose.yml` musi przyjmować `?size=256x256`. Do tego czasu okładki działają, a upload avatara zwraca niedostępność narzędzi (`TOOL_UNAVAILABLE`).

## Ustalenia

- Wdrożenie: import repo `Iicytower/story-app` z GitHuba w panelu Vercela. Każdy push na `main` wdraża produkcję, push na `staging` – staging.
- `AUTH_SECRET` generowany lokalnie (`openssl rand -base64 32`), nigdy nie wklejany do rozmowy z Claude.
- Atlas: Network Access `0.0.0.0/0`, użytkownik z silnym hasłem i rolą `readWrite`. W URI nazwa bazy przed `?` (`.../story_app?retryWrites=true&w=majority`), inaczej Mongoose użyje bazy `test`.
- Atlas M0 nie ma automatycznych backupów (dopiero Flex i wyżej). Backup: `scripts/backup.sh` ([`deploy/backup.md`](deploy/backup.md), D26).
- Function Region w Vercelu (Settings → Functions) ustawić na region klastra Atlasa (np. `fra1` dla Frankfurtu). Domyślnie funkcje szły do `iad1` (Waszyngton).
- Wersja MongoDB: wymagana ≥ 5.2 (reakcje, task 77, używają `$firstN`). Lokalnie i w testach `mongo:8`; wersję klastra Atlas (produkcja i staging) sprawdzić w panelu Atlasa przed wydaniem.
- Konto produkcyjne: `MONGODB_URI='mongodb+srv://...' npm run create-account` (pojedyncze cudzysłowy, bo zsh interpretuje `&` i `?`; plik `.env.local` musi istnieć).
- Predefiniowane tagi (D79) na stagingu lub produkcji: `MONGODB_URI='mongodb+srv://...' npm run tags -- set <klucz> '<en>' '<pl>'` (także `list`, `remove <klucz>`). Zmienna z powłoki wygrywa z `.env.local`. Lista startowa przychodzi migracją `007` w buildzie.
- Rola admina (D80, task 69) na stagingu lub produkcji: `MONGODB_URI='mongodb+srv://...' npm run admin -- add <nick>` (także `list`, `remove <nick>`). Zmienna z powłoki wygrywa z `.env.local`.

## Problem: JSON „There was a problem with the server configuration” po logowaniu

- Objaw: 500 na `/api/auth/callback/credentials`, w logu „No outgoing requests” (do Atlasa nic nie poszło).
- Ten JSON Auth.js zwraca tylko przy nieudanej kontroli konfiguracji: `MissingSecret`, `UntrustedHost` albo `InvalidCallbackUrl`. Błąd bazy lub hasła dałby „Invalid nickname or password.”.
- Pierwsza przyczyna: zmienne dodane po deployu. Vercel wczytuje zmienne dopiero przy deployu, więc po zmianie potrzebny **Redeploy**.
- Druga przyczyna: testowanie przez URL konkretnego deploymentu (`story-<hash>-iicytowers-projects.vercel.app`). Taki URL jest na stałe przypięty do jednej wersji, więc po redeployu dalej działał stary deployment bez zmiennych (ten sam Deployment ID w logach). Trzeba otwierać **domenę produkcyjną** z Settings → Domains (bez hasha) i wyczyścić cookies starego URL-a.
- Diagnostyka: w Logs szukać linii `[auth][error]` i porównać Deployment ID oraz region funkcji z oczekiwanymi.
- Awaryjnie: `AUTH_TRUST_HOST=true` + redeploy. Jeśli to pomoże, przyczyną był `UntrustedHost` i trzeba poprawić D4 w `decisions.md`.

## Smoke test

1. `/` pokazuje wyszukiwarkę bez logowania; „Log in / Create account” otwiera dialog, błędne hasło → „Invalid nickname or password.”, poprawne loguje.
2. Utworzenie opowiadania, treść, autozapis („Saved”); po odświeżeniu treść zostaje.
3. „Export as…” pobiera plik w wybranym formacie.
4. „Publish”: adres `/p/...` w incognito pokazuje opowiadanie z nickiem, bez notatek i komentarzy; po „Unpublish” 404.
5. Przełącznik motywu i wylogowanie.
6. Foldery: nowy folder, rozdział o tym samym tytule w dwóch folderach, przeniesienie rozdziału, notatki folderu z autozapisem.
7. Narzędzia (gdy `TOOLS_API_*` ustawione): „Korekta” → „Sprawdź” na rozdziale z błędem („Napewno”) podkreśla go w tekście, ✓ poprawia, a po odświeżeniu nierozpatrzone poprawki wracają. Pierwsze sprawdzenie po restarcie serwera może trwać do ok. minuty.
8. „Definicje” („kota”), „Synonimy” („dom”) i „Rymy” („kota”, z filtrem części mowy) zwracają wyniki ze źródłami.
9. Realtime (gdy `REALTIME_PUBLIC_URL` ustawione): w DevTools → Network żądanie `rt/stream` ma status 200 i typ `eventsource`, bez błędu CSP w konsoli; wiadomość z drugiego konta pojawia się w otwartej rozmowie i w liczniku „Messages” od razu, nie po 5/30 s.
