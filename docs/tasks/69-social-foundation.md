# 69 – Fundament społeczności

Subtask 68. Podstawa: D80 (Zakres i zasady ogólne; Role, bany, blokady – warstwa danych; Nawigacja). Branch `feature/69-social-foundation` z `feature/social`, merge do `feature/social`.

Przed kodem sprawdź w `node_modules/next/dist/docs/` aktualne API `after()`, Server Actions i `connection()` (AGENTS.md).

## Zakres

- `User.role?: "admin"` (brak = zwykły) i `User.globalBan?: { until: Date | null, reason, by, at }` (tylko pole; nadawanie w 88). Skrypt `npm run admin -- list|add <nick>|remove <nick>` (`scripts/admin.ts`, baza z `.env.local`, wzór `scripts/tags.ts`); nick z collation D37.
- Modele (`lib/models/`): `blocks` (`blockerId`, `blockedId`, `createdAt`, unikalny para), `communityBans` (`authorId`, `userId`, `until | null`, `reason` 1–500 znaków, `by`, `createdAt`, unikalny para), `communityModerators` (`authorId`, `userId`, `state: invited | active`, `createdAt`, unikalny para). Rejestracja przez `mongoose.models.X ?? …`.
- `lib/social/permissions.ts`: jedno miejsce sprawdzania udziału – `canInteract(actorId, { authorId, kind })` → `{ ok } | { ok: false, error: "FORBIDDEN" | "NOT_FOUND", key }` z uwzględnieniem: ban globalny, ban w społeczności (także wygasły = brak), blokada w obie strony (zablokowany u autora = ban bez terminu), `kind` (comment, react, rate, forumPost, dm, follow, mention). Plus `isModeratorOf(userId, authorId)`, `isAdmin(user)`, `hiddenAuthorsFor(viewerId)` (zbiór zablokowanych przez widza, do filtrów odczytu).
- Limity po koncie: `takeUserAttempt(rule, userId)` w `lib/rate-limit.ts` (kolekcja `rateLimits`, klucz `<reguła>:<userId>:<okno>`), połowa limitu dla konta młodszego niż 24 h. Reguły i wartości z D80 w jednym obiekcie `SOCIAL_LIMITS`.
- `lib/limits.ts`: `MAX_COMMENT_LENGTH` 5000, `MAX_POST_LENGTH` 20 000, `MAX_DM_LENGTH` 5000, `MAX_THREAD_TITLE_LENGTH` 200, `MAX_BIO_LENGTH` 1000, `MAX_BAN_REASON_LENGTH` 500, `MAX_REPORT_LENGTH` 1000, `MAX_NOTE_LENGTH` 2000, `MAX_QUOTE_LENGTH` 500; wpisy w `LENGTHS` z kluczami tłumaczeń.
- `components/social-markdown.tsx`: `react-markdown` + `remark-breaks`, `allowedElements` z D80, `unwrapDisallowed`, linki `rel="nofollow ugc noopener"` i `target="_blank"`, bez `rehype-raw`.
- Sidebar: pozycje z D80 (Feed, Biblioteka, Fora, Wiadomości, Powiadomienia, Mój profil, Moderacja, Admin, Statystyki) w `components/app-sidebar.tsx`, sterowane flagą per pozycja (`SOCIAL_NAV` w `lib/social/nav.ts`); w tym tasku wszystkie wyłączone, każdy kolejny task włącza swoją. Teksty w `messages/*` (grupa `nav`).
- Konta E2E `dave`, `erin` i `admin` (z `role: admin`) w seedzie (`tests/e2e/env.ts`, `global-setup.ts`) do scenariuszy wielu użytkowników; helper `loginAs` dla drugiego kontekstu przeglądarki.

## Kryteria akceptacji

1. `npm run admin` dodaje, usuwa i wypisuje adminów, odrzuca nieistniejący nick.
2. `canInteract` zwraca odmowę dla: bana globalnego aktywnego, bana w społeczności aktywnego, blokady w obie strony; przepuszcza po wygaśnięciu bana i bez relacji.
3. Unikalne indeksy par w `blocks`, `communityBans`, `communityModerators` (budowane przez `syncIndexes()`).
4. `takeUserAttempt` liczy po koncie i daje połowę limitu kontu młodszemu niż 24 h.
5. `SocialMarkdown` nie renderuje HTML, obrazków ani nagłówków; linki mają `rel` i `target` z D80.
6. Sidebar bez nowych pozycji przy wyłączonych flagach; włączona flaga pokazuje pozycję z tłumaczeniem en/pl.
7. Konta `dave`, `erin` i `admin` dostępne w E2E.

## Testy

- Unit: `lib/social/permissions.test.ts` (macierz przypadków z kryterium 2, z wstrzykniętymi danymi), `components/social-markdown.test.tsx` (5), `lib/limits.test.ts` (nowe klucze).
- Integracyjne: `tests/integration/social-permissions.test.ts` (2 na bazie, 3 przez `E11000`), `tests/integration/rate-limit.test.ts` (4), `tests/integration/admin-script.test.ts` (1).
- E2E: `tests/e2e/layout.spec.ts` (6, bez zmian w sidebarze), `tests/e2e/social-users.spec.ts` (7, logowanie `dave` i `erin` w dwóch kontekstach).
