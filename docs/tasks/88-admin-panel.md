# 88 – Panel admina

Subtask 68, zależy od 80 i 87. Podstawa: D80 (Fora i panel admina – panel; Role, bany, blokady – ban globalny, 18+ admina). Branch `feature/88-admin-panel` z `feature/social`, merge do `feature/social`.

## Zakres

- Strona `/admin` (tylko `role: admin`, inni → 404) z zakładkami:
  - Zgłoszenia z trasy `admin` (80): podgląd obiektu, rozstrzygnięcie, ukrycie treści, przejście do bana.
  - Ban globalny: `setGlobalBan(nick, duration: 1 | 7 | 30 | null, reason)` (powód obowiązkowy), `liftGlobalBan`; lista aktywnych. Skutek z D80 przez `canInteract` i filtry odczytu (publikacje, komentarze i posty zbanowanego ukryte na czas bana). Filtr bana globalnego w `lib/publish/queries.ts`: `getPublishedFolder`, `findSearchableFolders` (wyszukiwarka, tagi), `listRecentlyPublished`, strona rozdziału, profil (70), feed (75), rankingi (84). Admin nie banuje admina.
  - 18+ admina: wyszukanie folderu, rozdziału lub okładki po adresie publicznym; `setAdminAdult(target, true | false | null)`. Pole `adult.admin` w `AdultMark` (D67): `true` blokuje zdjęcie przez autora (`ADULT_LOCKED`), `false` nadpisuje `auto` i `manual`; autor może potem ustawić `manual` ponownie (zdejmuje to `admin: false`). `chapterAdultState` i blokady z D67 uwzględniają nowe pole; `isAdult` sprawdza `admin` przed `manual`/`auto`. W `covers` nowe pole `adminAdult?: boolean` z tą samą semantyką. `adult.admin: false` na rozdziale nie znosi 18+ folderu (blokada `folder` z D67 zostaje).
  - Kategorie forum: dodanie, zmiana etykiet en/pl, kolejność, `adminOnly`, usunięcie (także startowych; wątki usuwanej kategorii ukryte, nie kasowane); moderatorzy kategorii (dodanie i usunięcie po nicku). Klucz nowej kategorii: angielska etykieta znormalizowana jak klucz tagu D79, kolizja → `INVALID_INPUT`.
  - Log: wpisy `moderationLog` globalne i wszystkich społeczności, stronicowane po 50, filtr po autorze.
  - Predefiniowane tagi (D79): lista, dodanie, zmiana etykiet, usunięcie z tą samą walidacją co skrypt (wspólna funkcja); `npm run tags` zostaje.
- Ban globalny zamyka też dostęp pod bezpośrednim adresem: spis książki zbanowanego autora (72) i `/avatars/<id>` jego avatara (70) → 404 dla innych.
- Każde działanie w `moderationLog` (`scope: global`). Pozycja „Admin” w sidebarze tylko dla admina.
- Moderacja (79): log globalny – `moderationLog` z `scope: global` (86), widok w panelu admina; dziś log społeczności widzi tylko autor w `/moderation`.
- Zgłoszenia (80): kolejka na `listAdminReports` (`lib/social/moderation.ts`) – dziś bez kontroli roli i zwraca nick zgłaszającego, więc wywołanie tylko za guardem roli admina; rozstrzyganie trasy `admin` przez istniejące `resolveReport` (`app/[locale]/(protected)/moderation/actions.ts`, sprawdza rolę).
- Powiadomienia (81): powiadomienia zgłoszeń trasy `admin` mają dziś `href: null` – dopisać link do kolejki w panelu admina.
- Rankingi (84): ban globalny autora ukrywa go w rankingach od razu (filtr przy renderze), czytelnicy i oceniający zbanowani po przeliczeniu liczą się do następnego przeliczenia (≤ 1 h).

## Kryteria akceptacji

1. Nie-admin dostaje 404 na `/admin` i `NOT_FOUND` z każdej akcji admina.
2. Ban globalny z powodem i terminem: zbanowany nie ma udziału, jego publikacje i treści znikają dla innych, po terminie wracają.
3. 18+ admina `true` blokuje zdjęcie przez autora; `false` zdejmuje oznaczenie mimo `auto`; autor może ponownie oznaczyć.
4. Kategorie: dodanie, zmiana, usunięcie (także startowej), moderatorzy kategorii działają w forach.
5. Tagi z panelu przechodzą tę samą walidację co skrypt.
6. Działania admina w logu; zakładka „Log” pokazuje wpisy globalne i wszystkich społeczności z filtrem po autorze.

## Testy

- Unit: `lib/adult/adult.test.ts` (3, stany z `admin`).
- Integracyjne: `tests/integration/admin.test.ts` (1, 2 – test na każdą funkcję odczytu z listy filtrów bana globalnego, 4, 5, 6), `tests/integration/adult.test.ts` (3).
- E2E: `tests/e2e/admin.spec.ts` (konto `admin` z seeda (69); zgłoszenie od `dave` rozstrzygnięte, ban `erin`, 18+ na rozdziale `alice`).
