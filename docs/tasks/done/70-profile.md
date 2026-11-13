# 70 – Profil użytkownika

Subtask 68, zależy od 69. Podstawa: D80 (Profil, relacje, biblioteka – profil i avatar; Zakres i zasady ogólne). Branch `feature/70-profile` z `feature/social`, merge do `feature/social`.

## Zakres

- Strona `/p/<nick>` (`app/[locale]/p/[nickname]/page.tsx`): avatar, bio (`SocialMarkdown`), lista opublikowanych książek (warunki widoczności D38, okładki i 18+ jak D69), miejsca na listy obserwujących/obserwowanych (71) i bibliotekę (72), przyciski Obserwuj / Wiadomość / Zablokuj / Zgłoś jako szkielet włączany przez kolejne taski. Nick w złej wielkości liter przekierowuje (jak D38). Konto bez nicku lub nieistniejące → 404. Metadata: „<nick> – Story App”.
- Profil w ustawieniach: kolekcja `profiles` (`userId` unikalny, `bio`, `avatarId`, `libraryPublic: true`, `updatedAt`) albo pola w `settings` (decyzja implementera, zapisana w D80). Akcja `updateBio` (limit `MAX_BIO_LENGTH`).
- Avatar: dialog „Avatar” z kadrem 1:1 (kod z dialogu okładki, D68), WebP 256×256, akcja `uploadAvatar` przez ten sam klasyfikator, synchronicznie: werdykt 18+ → odrzucenie z komunikatem (bez rozmycia), błąd lub brak odpowiedzi klasyfikatora → `TOOLS_UNAVAILABLE`, bez stanu `pending` i ponowień z D68. Limit globalny sumuje `size` z `covers` i `avatars` (wspólna funkcja w `lib/covers/covers.ts`, używana w `setFolderCover` i `uploadAvatar`); `COVERS_PER_ACCOUNT` nie dotyczy avatara. `GET /avatars/<id>` (`public`, `immutable`). Bez `TOOLS_API_URL` przycisk uploadu niedostępny. Brak avatara: komponent `UserAvatar` z inicjałami i kolorem z hasha nicku.
- `UserAvatar` i `UserLink` (nick → `/p/<nick>`) jako wspólne komponenty dla kolejnych tasków.
- Pozycja „Mój profil” w sidebarze włączona.

## Kryteria akceptacji

1. Gość i zalogowany widzą profil z bio i tylko publicznymi książkami; prywatne foldery i ukryte rozdziały niewidoczne.
2. Nieistniejący nick i konto bez nicku → 404; zła wielkość liter → przekierowanie.
3. Właściciel zmienia bio (limit długości, markdown bez HTML); inny użytkownik nie może zmienić cudzego profilu (akcja bierze `userId` z sesji).
4. Upload avatara: obraz z werdyktem „nie 18+” widoczny na profilu; 18+ odrzucony; bez serwera narzędzi upload niedostępny.
5. Brak avatara pokazuje inicjały.
6. Teksty en/pl, metadata strony.

## Testy

- Unit: `components/user-avatar.test.tsx` (5, kolor deterministyczny).
- Integracyjne: `tests/integration/profile.test.ts` (1 zapytanie publicznych książek, 3 izolacja i limit), `tests/integration/avatars.test.ts` (4 z atrapą klasyfikatora, limit globalny).
- E2E: `tests/e2e/profile.spec.ts` (1, 2, 3, 5, 6; avatar 18+ przez istniejące `POST /classify/mode` = `adult` w `fake-tools.mjs` – kryterium 4).
