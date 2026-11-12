# 92 – Wydanie systemu społecznościowego: kroki ręczne

**Task do wykonania ręcznie przez użytkownika** (nie przez Claude ani `/autorun`). Zbiera sprawdzenia i ustawienia przed i po wydaniu `feature/social` (taski 68–91, D80), których nie da się zautomatyzować testami. Szczegóły kroków: `docs/deploy.md` („Wydanie systemu społecznościowego”, „Serwer narzędzi na Mikrusie”).

## Zakres

1. Przegląd sekcji „Rozstrzygnięcia Claude'a do potwierdzenia” we wszystkich plikach [`docs/decisions/d80/`](../decisions/d80/); zmiany zgłosić jako osobne poprawki.
2. Backup bazy (`scripts/backup.sh`) przed merge'em.
3. Merge `feature/social` → `develop`.
4. Serwer narzędzi: `npm run tools:remote` (nowa usługa `realtime`, klasyfikator z `?size=256x256` dla avatarów – bez tego upload avatara zwraca `TOOL_UNAVAILABLE`). Sprawdzić, że obraz `node:24.22.2-alpine` istnieje i usługa wstaje.
5. Coolify: zmienna usługi `APP_ORIGIN` = adresy produkcji i stagingu po przecinku.
6. Vercel (Production i Preview `staging`): `REALTIME_PUBLIC_URL`.
7. Realtime ręcznie (kroki `curl` z `docs/deploy.md`): lokalny stos, fałszywy Mikrus, wykr.es – w szczególności czy proxy Mikrusa nie buforuje SSE (zdarzenie dochodzi od razu, a nie przy zamknięciu strumienia).
8. Atlas (produkcja i staging): wersja MongoDB ≥ 5.2 (reakcje używają `$firstN`).
9. Wydanie na staging, potem produkcję: w logu builda `Applying 008-forum-categories`.
10. Po wdrożeniu: `npm run admin -- add <nick>` na właściwej bazie.
11. Przejście po aplikacji na stagingu (desktop i telefon): profil i avatar, obserwowanie, biblioteka, komentarze, reakcje, oceny, zgłoszenia, powiadomienia (także realtime), wiadomości, blokady, fora, panel admina, usunięcie konta testowego.

## Kryteria akceptacji

1. Rozstrzygnięcia D80 przejrzane. `manual`
2. Stos narzędzi wdrożony, avatar się wgrywa, `/health` OK. `manual`
3. `APP_ORIGIN` i `REALTIME_PUBLIC_URL` ustawione; powiadomienie i wiadomość dochodzą bez odświeżania (SSE, bez buforowania). `manual`
4. Atlas ≥ 5.2 na obu bazach. `manual`
5. Migracja 008 zastosowana na stagingu i produkcji, admin dodany. `manual`
6. Przejście po aplikacji (punkt 11) bez błędów. `manual`

## Testy

Brak automatycznych – wszystkie kryteria `manual`.
