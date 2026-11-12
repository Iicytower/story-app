# D80 – Zakres i zasady ogólne

Część decyzji D80 (System społecznościowy, 2026-11-10); indeks w [`../../decisions.md`](../../decisions.md).

- W zakresie: profil, obserwowanie, biblioteka z półkami, postęp czytania, zakładki i notatki czytelnika, feed, komentarze, reakcje, oceny, moderacja autora, zgłoszenia, powiadomienia, wzmianki, statystyki autora, rankingi, DM, blokowanie, fora autora i globalne, panel admina, usuwanie konta, realtime.
- Poza zakresem: współpraca przy pisaniu, komentarze do fragmentu widoczne dla innych, listy lektur, recenzje, konkursy, e-maile (D37).
- Gość czyta i widzi liczniki, profile, komentarze i fora (indeksowane, bez `noindex`). Każdy udział (komentarz, reakcja, ocena, post, DM, obserwowanie, biblioteka, zgłoszenie) wymaga logowania; przycisk u gościa otwiera dialog logowania (D42).
- Każdy zapis to Server Action z `requireUser()`, `userId` z sesji, wynik `{ ok, ... }` (bez wyjątków), guardy z D71. Cudzy lub niewidoczny obiekt → `NOT_FOUND`. Każdy tekst w `messages/en.json` i `pl.json`. Uprawnienia (ban, blokada, ban globalny, wyłączone komentarze) sprawdza jedna funkcja `lib/social/permissions.ts` (task 69), nigdy kod w komponencie.
- Treść społecznościowa (komentarz, post, DM, bio) to markdown przez `react-markdown` z `allowedElements` (akapit, pogrubienie, kursywa, link, cytat, `br`) i `remark-breaks`, bez `rehype-raw` i bez obrazków. Linki `rel="nofollow ugc noopener"`, `target="_blank"`.
- Widoczność: komentarze, reakcje i oceny rozdziału lub folderu są widoczne tylko, gdy obiekt jest publiczny (D38). Cofnięcie publikacji lub soft delete je ukrywa bez kasowania, ponowna publikacja przywraca; twarde usunięcie rozdziału lub folderu kasuje je razem z nim.
- Pakiety (decyzja użytkownika, lista zamknięta): `recharts` (shadcn `chart`), `cmdk` (shadcn `command`), `sonner` (shadcn `sonner`, podpięty pod motyw z `lib/theme.ts`, bez `next-themes`). Instalowane raz na starcie `feature/social`. Pozostałe komponenty shadcn (`tabs`, `avatar`, `badge`, `switch`, `select`, `textarea`, `popover`, `sheet`) tylko gdy nie dodają zależności. Zadania okresowe bez crona: TTL albo leniwe przeliczenie w `after()` z atomowym przejęciem (jak D68).

## Rozstrzygnięcia Claude'a do potwierdzenia

Przebieg 68 zakończony (2026-11-11); lista czeka na przegląd użytkownika przed merge'em `feature/social` do `develop`.

- Nazwy kolekcji i pól, szczegółowy podział tasków 69–91 i ich kryteria.
- Rodzaje powiadomień wyłączalne pojedynczo (odpowiedź „konfigurowalne w ustawieniach” razem z „per grupa”).
- Ban globalny ukrywa także komentarze i posty zbanowanego na czas bana.
- Antyspam dla reakcji i ocen (60/min), limity powodów (500/1000), 10 moderatorów na autora, 20 półek.
- Konto E2E `admin` (rola admin) obok `dave` i `erin` (task 69); `carol` zostaje dla testów haseł.
- Blokada działa jak ban bez terminu przez `canInteract`, bez dokumentu w `communityBans`, więc odblokowanie go zdejmuje.
- 18+ admina: ponowne `manual` od autora zdejmuje `admin: false`; okładka ma własne pole w `covers`.
- Usunięcie konta kasuje też rozmowy DM z tym kontem u drugiej strony i `dailyStats` jego tekstów.
- Dodatkowe limity: nazwa półki 50, nazwa zakładki 100, kontekst cytatu 50 znaków, najwyżej 10 wzmianek na treść.
- Usunięcie kategorii forum ukrywa jej wątki (bez kasowania); migracja `008-forum-categories`.
- Realtime: token HMAC ważny 10 min, klucz wyprowadzony z `TOOLS_API_SECRET`, CORS serwisu przez zmienną `APP_ORIGIN`.
- Poza zakresem 70 (do osobnego taska): strona 404 ignoruje ciemny motyw; długa nazwa folderu na `/stories` przy 375 px przewija poziomo.
- Tombstone a ban (91): aktywny ban globalny zostaje na tombstonie (wygasły zdejmowany); nie da się go zdjąć (wyszukiwanie nicku przez admina pomija tombstone), czasowy wygasa sam; `listGlobalBans` nie listuje tombstone'ów.
- Blokady a usunięcie konta (91): blokady innych wobec usuniętego konta zostają (purge kasuje tylko `blockerId`); `listBlocked` nie pokazuje tombstone'a, ale `total` go liczy.
- Publikacja zbanowanego (91): autor z aktywnym banem globalnym nie tworzy wpisu feedu ani powiadomień „nowy rozdział” (bez nadrabiania po zdjęciu bana).
- Tombstone w `decideInteraction` (91): usunięty aktor → `FORBIDDEN`; usunięty autor → `NOT_FOUND` tylko dla `dm` (odpowiedzi i reakcje na jego treść dozwolone). Odbiorcy powiadomień pomijają też tombstone'y.
- Limit przed wyszukaniem nicku (91): follow, unfollow, block, `startConversation`; nieznane nicki zużywają próbę. `startConversation`: najpierw minutowy, potem dobowy (odwrotnie niż 69), odmowa dobowego zwraca minutowy; nowa rozmowa też liczy się do minutowego.
- Admin i forum autora (91): `adminHide` rozwiązuje forum autora bez filtrów widoczności (flaga `unfiltered`) – działa też przy banie autora i bez publicznej książki.
- Odbiorcy bez zbanowanych (91): powiadomienia o ukrytym wątku i odbiorcy zgłoszeń społeczności bez kont z aktywnym banem globalnym.
- Cytat w forum (91): czysty tekst (`PlainMarkdown`); elementy listy jako osobne akapity.
- 404 poza locale (91): idzie za motywem systemu przez `applyTheme` po stronie klienta (możliwe mignięcie jasnego motywu).
- Sidebar (91): `SOCIAL_NAV` i `lib/social/nav.ts` usunięte (typ `SocialNavItem` w `app-sidebar.tsx`), widoczność tylko przez `hiddenItems`; „Mój profil” podświetlony na własnym profilu (prop `profilePath`, bez rozróżniania wielkości liter).
- UI (91): `overflow-wrap` na h1 rozdziału i książki oraz w `markdown-preview`; link bana w panelu admina się zawija; przycisk blokady `min-h-8 self-start`; wskazówka przewijania tabeli statystyk poniżej `md`; pl `inFolderBy` „w książce”.
- Dokumentacja (91): `README.md` (funkcje społecznościowe, `recharts`, `cmdk`, `sonner`, SSE) i `docs/deploy.md` (kolejność wydania `feature/social`: kopia bazy, serwer narzędzi z `realtime`, `REALTIME_PUBLIC_URL`, migracja `008`, `npm run admin -- add`).
- Otwarte (91, niskie, bez zmian): token SSE niezwiązany z sesją (do 10 min po wylogowaniu, banie lub usunięciu; zdarzenia bez treści); `getThread` bez stronicowania; `hiddenUserIdsFor` bez limitu liczby blokad; `createThread` zużywa `threadDay` przed sprawdzeniem forum.
- `manual` (91): kroki realtime z „Luk (90)” (lokalny stos, fałszywy Mikrus, wykr.es) do wykonania przez użytkownika.
