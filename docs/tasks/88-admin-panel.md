# 88 – Panel admina

Subtask 68, zależy od 80 i 87. Podstawa: D80 (Fora i panel admina – panel; Role, bany, blokady – ban globalny, 18+ admina). Branch `feature/88-admin-panel` z `feature/social`, merge do `feature/social`.

## Zakres

- Strona `/admin` (tylko `role: admin`, inni → 404) z zakładkami:
  - Zgłoszenia z trasy `admin` (80): podgląd obiektu, rozstrzygnięcie, ukrycie treści, przejście do bana.
  - Ban globalny: `setGlobalBan(nick, duration: 1 | 7 | 30 | null, reason)` (powód obowiązkowy), `liftGlobalBan`; lista aktywnych. Skutek z D80 przez `canInteract` i filtry odczytu (publikacje, komentarze i posty zbanowanego ukryte na czas bana). Admin nie banuje admina.
  - 18+ admina: wyszukanie folderu, rozdziału lub okładki po adresie publicznym; `setAdminAdult(target, true | false | null)`. Pole `adult.admin` w `AdultMark` (D67): `true` blokuje zdjęcie przez autora (`ADULT_LOCKED`), `false` nadpisuje `auto` i `manual`; autor może potem ustawić `manual` ponownie (zdejmuje to `admin: false`). `chapterAdultState` i blokady z D67 uwzględniają nowe pole; okładka dziedziczy z `covers`.
  - Kategorie forum: dodanie, zmiana etykiet en/pl, kolejność, `adminOnly`, usunięcie (także startowych; wątki usuwanej kategorii ukryte, nie kasowane); moderatorzy kategorii (dodanie i usunięcie po nicku).
  - Predefiniowane tagi (D79): lista, dodanie, zmiana etykiet, usunięcie z tą samą walidacją co skrypt (wspólna funkcja); `npm run tags` zostaje.
- Każde działanie w `moderationLog` (`scope: global`). Pozycja „Admin” w sidebarze tylko dla admina.

## Kryteria akceptacji

1. Nie-admin dostaje 404 na `/admin` i `NOT_FOUND` z każdej akcji admina.
2. Ban globalny z powodem i terminem: zbanowany nie ma udziału, jego publikacje i treści znikają dla innych, po terminie wracają.
3. 18+ admina `true` blokuje zdjęcie przez autora; `false` zdejmuje oznaczenie mimo `auto`; autor może ponownie oznaczyć.
4. Kategorie: dodanie, zmiana, usunięcie (także startowej), moderatorzy kategorii działają w forach.
5. Tagi z panelu przechodzą tę samą walidację co skrypt.
6. Działania admina w logu.

## Testy

- Unit: `lib/adult/adult.test.ts` (3, stany z `admin`).
- Integracyjne: `tests/integration/admin.test.ts` (1, 2, 4, 5, 6), `tests/integration/adult.test.ts` (3).
- E2E: `tests/e2e/admin.spec.ts` (konto `admin` z seeda (69); zgłoszenie od `dave` rozstrzygnięte, ban `erin`, 18+ na rozdziale `alice`).
