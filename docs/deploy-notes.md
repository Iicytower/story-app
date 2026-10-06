# Notatki z wdrożenia (2026-10-06)

Robocze notatki do taska 13 (`docs/tasks/13-deploy.md`). Docelowo trafią do README.

## Ustalenia

- Wdrożenie: import repo `Iicytower/story-app` z GitHuba w panelu Vercela. Każdy push na `main` wdraża produkcję, rollback przez „Promote” poprzedniego deploymentu.
- Zmienne `MONGODB_URI` i `AUTH_SECRET` ustawione tylko dla środowiska **Production** (preview deploymenty nie dotykają produkcyjnej bazy).
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
- Awaryjnie: `AUTH_TRUST_HOST=true` (Production) + redeploy. Jeśli to pomoże, przyczyną był `UntrustedHost` i trzeba poprawić D4 w `decisions.md`.

## Smoke test (do README)

1. `/` przekierowuje na `/login`; błędne hasło → „Invalid email or password.”, poprawne loguje.
2. Utworzenie opowiadania, treść, autozapis („Saved”); po odświeżeniu treść zostaje.
3. „Export .md” pobiera plik z frontmatterem.
4. „Share”: link w incognito pokazuje opowiadanie bez notatek i komentarzy; po „Stop sharing” 404.
5. Przełącznik motywu i wylogowanie.

## Do uzupełnienia

- Co ostatecznie rozwiązało problem z logowaniem i czy `AUTH_TRUST_HOST` zostało dodane.
- Domena produkcyjna i ustawiony Function Region.
- Wynik smoke testu.
