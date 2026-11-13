# 91 – Audyt bezpieczeństwa i E2E całości

Subtask 68, zależy od wszystkich subtasków 69–90. Podstawa: D80 (cała). Branch `feature/91-social-audit` z `feature/social`, merge do `feature/social`.

## Zakres

- Przegląd agentem `security-auditor` całego diffu `develop...feature/social`: izolacja (`userId` z sesji, cudze → `NOT_FOUND`), `canInteract` w każdej akcji zapisu, filtry blokad i banów w każdym odczycie, XSS w `SocialMarkdown` i wzmiankach, limity długości i antyspamu, token i CORS SSE, CSP, enumeracja kont (profil, podpowiedzi nicków), wyciek ocen (anonimowość), widoczność treści niepublicznych (D38), tombstone kont. Raport w `docs/tasks/91-social-audit.md` (sekcja „Wyniki”); krytyczne i ważne poprawione w tym tasku z testami.
- Panel admina (88): kompletność filtrów bana globalnego w każdym odczycie i zapisie społeczności (książka, okładka, avatar, feed, wyszukiwarka, fora, komentarze, DM, powiadomienia); każda akcja admina sprawdza rolę zaraz po sesji i loguje do `moderationLog`; `listAdminReports`/`listAdminQueue` bez własnej kontroli roli; zbanowany moderator kategorii w `moderatorIds`.
- Usuwanie konta (89): kompletność usuwania – każda kolekcja z danymi konta (także dodana po 89) obsłużona w `purgeAccountData`/`PURGES` albo świadomie zostawiona z tombstone (rozstrzygnięcia (89) w D80); okno do końca sprzątania (`cleanupPendingAt`) – co tombstone blokuje od razu (logowanie, reset kodem, sesje, profil, książki 404, powiadomienia), a co jest jeszcze dostępne (avatar i okładki po id, rankingi, „ostatnio opublikowane”, rozmowy, zapisy z innych instancji w oknie cache sesji) i czy ponowienie zawsze dokańcza sprzątanie.
- Scenariusz E2E `tests/e2e/social-journey.spec.ts` na kontach `alice`, `dave`, `erin` i `admin`: profil i obserwowanie, publikacja i feed, biblioteka i „Czytaj dalej”, komentarz z wzmianką, reakcja, ocena, powiadomienie, DM, zgłoszenie i moderacja, blokada, forum, statystyki, ranking, usunięcie konta.
- Przegląd UI agentem `ui-checker` nowych stron (desktop 1280, 375 px, jasny i ciemny, en i pl); poprawki brakujących tłumaczeń i układu.
- Realtime (90): audyt tokenu HMAC (format, wygasanie, klucz pochodny `TOOLS_API_SECRET`), trasy Caddy (publicznie tylko `/rt/stream`, reszta `/rt/*` → 401, `/publish` z sekretem), limitów serwisu (strumienie na konto i globalne, `/publish`, body, pamięć) oraz wykonanie kroków `manual` z rozstrzygnięć (90) w D80 (lokalny stos, fałszywy Mikrus, wykr.es).
- `SOCIAL_NAV` (69) usunięty, gdy wszystkie pozycje są włączone.
- `README.md` (opis i stack: system społecznościowy, `recharts`, `cmdk`, `sonner`, usługa SSE), `docs/deploy.md` (zmienne, migracja `008`, kolejność wydania: serwer narzędzi z usługą `realtime` przed wydaniem).

## Kryteria akceptacji

1. Raport audytu w pliku taska; brak otwartych uwag krytycznych i ważnych.
2. Scenariusz `social-journey.spec.ts` przechodzi.
3. Przegląd UI bez brakujących tłumaczeń i poziomego przewijania na 375 px na nowych stronach.
4. `README.md` i `docs/deploy.md` zaktualizowane.
5. `npm run verify` na `feature/social` przechodzi.

## Testy

- E2E: `tests/e2e/social-journey.spec.ts` (2), testy regresji dopisane do poprawek z audytu (1).
- `manual`: 1 (raport), 3 (zrzuty `ui-checker`), 4 (przegląd użytkownika).

## Wyniki

Audyt `security-auditor` (diff `develop...feature/social`): brak krytycznych; 1 wysokie, 2 średnie, 7 niskich. Bez uwag: izolacja, `canInteract` w zapisach, panel admina, moderacja, XSS, anonimowość ocen, D38, realtime i Caddy, tombstone, kompletność purge (poza 2).

Wysokie:

1. Usunięcie konta zdejmowało `globalBan` z tombstone'a → ukryte komentarze, posty i wątki wracały (admin nie zbanuje ponownie, `findUserByNick` pomija tombstone). **Poprawione**: aktywny ban zostaje na tombstonie.

Średnie:

2. Purge kasował blokady innych wobec usuwanego (`blockedId`) → treść wracała u blokujących. **Poprawione**: kasowane tylko blokady konta (`blockerId`).
3. Zbanowany globalnie autor rozsyłał powiadomienia „nowy rozdział” (`recordChaptersPublished` bez sprawdzenia bana). **Poprawione**: przy aktywnym banie bez `recordActivity` i `notifyNewChapters`.

Niskie:

4. `canInteract` bez `NOT_DELETED` – DM do tombstone'a w oknie sprzątania. **Poprawione**: `decideInteraction` – usunięty aktor → `FORBIDDEN`, usunięty autor → `NOT_FOUND` dla `dm`.
5. Token SSE niezwiązany z sesją (do 10 min po wylogowaniu, banie, usunięciu; zdarzenia bez treści). **Otwarte** (D80, wpis „Otwarte (91)”).
6. Wyszukanie nicku przed limitem (`startConversation`, follow, unfollow, `blockStep`) – enumeracja bez limitu. **Poprawione**: limit przed wyszukaniem. **Otwarte**: `createThread` zużywa `threadDay` przed sprawdzeniem forum.
7. Admin nie ukrywał posta w forum zbanowanego autora lub bez publicznej książki (`authorPlace` → `null`). **Poprawione**: `adminHide` rozwiązuje forum bez filtrów widoczności.
8. `threadReplyRecipients` dla ukrytego wątku powiadamiał zbanowanych moderatorów kategorii i adminów. **Poprawione**: bez zbanowanych globalnie (także odbiorcy zgłoszeń społeczności).
9. `getThread` bez stronicowania (500 × 20 KB). **Otwarte**.
10. `hiddenUserIdsFor` bez limitu liczby blokad. **Otwarte**.

Poprawki 1, 2, 3, 4, 6, 7, 8 z testami regresji (integracyjne i unit `permissions.test.ts`).

Przegląd UI (`ui-checker`, 1280 i 375 px, jasny i ciemny, en i pl): brak braków w tłumaczeniach i elementów bez nazwy. Poprawione: poziome przewijanie przez h1 rozdziału i książki (`overflow-wrap`, też w `markdown-preview`), zawijanie linku bana w panelu admina, przycisk blokady (`min-h-8 self-start`), cytat w forum jako czysty tekst (`PlainMarkdown`), 404 poza locale w ciemnym motywie, pl „w książce” (`inFolderBy`), wskazówka przewijania tabeli statystyk poniżej `md`, podświetlenie „Mój profil” na własnym profilu. `SOCIAL_NAV` usunięty.

`manual` realtime (D80 (90), „Luki”): lokalny stos, fałszywy Mikrus i produkcja na wykr.es – do wykonania przez użytkownika.
