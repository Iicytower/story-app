# Wdrożenie

## Środowiska

| Środowisko | Branch | Vercel | Baza (Atlas, ten sam klaster) |
| --- | --- | --- | --- |
| Produkcja | `main` | Production | `story-app` |
| Staging | `staging` | Preview, zmienne przypięte do brancha `staging` | `story-app-staging` |
| Lokalnie | dowolny | – | Docker, `story_app` (`npm run db:up`) |

- Vercel: Settings → Environment Variables → `MONGODB_URI` i `AUTH_SECRET` dla **Preview** z wybranym branchem `staging`. Inny `AUTH_SECRET` niż na produkcji. URI różni się od produkcyjnego tylko nazwą bazy (`.../story-app-staging?...`).
- Preview innych branchy (`feature/*`) nie dostaje zmiennych, więc nie łączy się z żadną bazą.
- Stały adres stagingu: Settings → Domains → dodać domenę i przypisać ją do brancha `staging` (zamiast URL-i deploymentów z hashem).
- Konto na stagingu: `MONGODB_URI='mongodb+srv://.../story-app-staging?...' npm run create-account` (niepotrzebne, jeśli baza zaimportowana z produkcji).

## Do zrobienia na koniec (po kodzie)

Na razie praca tylko lokalnie; hosting stagingu konfigurujemy po zakończeniu zmian w kodzie.

- [x] Baza `story-app-staging` w Atlasie.
- [ ] Vercel → Environment Variables: `MONGODB_URI` (baza `story-app-staging`) i nowy `AUTH_SECRET` dla Preview, branch `staging`; redeploy.
- [ ] Vercel → Domains: stała domena przypisana do brancha `staging`.
- [ ] Import danych z produkcji do `story-app-staging` (`mongodump` z `story-app` + `mongorestore --nsFrom 'story-app.*' --nsTo 'story-app-staging.*'` przez `docker run --rm mongo:8`).
- [ ] Smoke test na stagingu.

## Wydanie

1. Taski zmergowane do `staging`, smoke test na stagingu.
2. Merge `staging` → `main` robi użytkownik (nigdy push na `main` z lokalnego repo), potem tag `vX.Y.Z` → deploy produkcji.
3. Rollback: „Promote” poprzedniego deploymentu w Vercelu.

## Ustalenia

- Wdrożenie: import repo `Iicytower/story-app` z GitHuba w panelu Vercela. Każdy push na `main` wdraża produkcję, push na `staging` – staging.
- `AUTH_SECRET` generowany lokalnie (`openssl rand -base64 32`), nigdy nie wklejany do rozmowy z Claude.
- Atlas: Network Access `0.0.0.0/0`, użytkownik z silnym hasłem i rolą `readWrite`. W URI nazwa bazy przed `?` (`.../story_app?retryWrites=true&w=majority`), inaczej Mongoose użyje bazy `test`.
- Atlas M0 nie ma automatycznych backupów (dopiero Flex i wyżej). Plan: ręczny `mongodump` przez `docker run --rm mongo:8 mongodump ...`, bez instalowania MongoDB Database Tools.
- Function Region w Vercelu (Settings → Functions) ustawić na region klastra Atlasa (np. `fra1` dla Frankfurtu). Domyślnie funkcje szły do `iad1` (Waszyngton).
- Konto produkcyjne: `MONGODB_URI='mongodb+srv://...' npm run create-account` (pojedyncze cudzysłowy, bo zsh interpretuje `&` i `?`; plik `.env.local` musi istnieć).

## Problem: JSON „There was a problem with the server configuration” po logowaniu

- Objaw: 500 na `/api/auth/callback/credentials`, w logu „No outgoing requests” (do Atlasa nic nie poszło).
- Ten JSON Auth.js zwraca tylko przy nieudanej kontroli konfiguracji: `MissingSecret`, `UntrustedHost` albo `InvalidCallbackUrl`. Błąd bazy lub hasła dałby „Invalid email or password.”.
- Pierwsza przyczyna: zmienne dodane po deployu. Vercel wczytuje zmienne dopiero przy deployu, więc po zmianie potrzebny **Redeploy**.
- Druga przyczyna: testowanie przez URL konkretnego deploymentu (`story-<hash>-iicytowers-projects.vercel.app`). Taki URL jest na stałe przypięty do jednej wersji, więc po redeployu dalej działał stary deployment bez zmiennych (ten sam Deployment ID w logach). Trzeba otwierać **domenę produkcyjną** z Settings → Domains (bez hasha) i wyczyścić cookies starego URL-a.
- Diagnostyka: w Logs szukać linii `[auth][error]` i porównać Deployment ID oraz region funkcji z oczekiwanymi.
- Awaryjnie: `AUTH_TRUST_HOST=true` + redeploy. Jeśli to pomoże, przyczyną był `UntrustedHost` i trzeba poprawić D4 w `decisions.md`.

## Smoke test

1. `/` przekierowuje na `/login`; błędne hasło → „Invalid email or password.”, poprawne loguje.
2. Utworzenie opowiadania, treść, autozapis („Saved”); po odświeżeniu treść zostaje.
3. „Export .md” pobiera plik z frontmatterem.
4. „Share”: link w incognito pokazuje opowiadanie bez notatek i komentarzy; po „Stop sharing” 404.
5. Przełącznik motywu i wylogowanie.
