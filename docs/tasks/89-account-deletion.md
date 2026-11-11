# 89 – Usuwanie konta

Subtask 68, zależy od 69–88. Podstawa: D80 (Konto). Zmienia D37 (konta nie dało się usunąć). Branch `feature/89-account-deletion` z `feature/social`, merge do `feature/social`.

## Zakres

- „Usuń konto” w dialogu ustawień: obecne hasło i wpisanie nicku; limit błędnych haseł jak `changePassword` (D75).
- Akcja `deleteAccount`: usuwa (przez `purgeSocialData` z 69 dla danych jego tekstów, także notatek i postępu innych czytelników na nich) foldery, rozdziały, wersje, okładki, avatar, profil, ustawienia, słownik użytkownika, obserwacje (obie strony), bibliotekę i półki, postęp, zakładki i notatki, powiadomienia (własne i te, gdzie był jedynym aktorem), oceny, reakcje, DM (rozmowy i wiadomości obu stron rozmowy z tym kontem), blokady, bany i role moderatora, `readEvents`; `dailyStats` jego tekstów. Kasowane też: `activity` (aktor), `threadFollows`, `communityBans` i `communityModerators` w obu rolach, zgłoszenia złożone przez konto. Forum autora usuwanego konta: wątki i posty kasowane razem z kontem. Wpisy `moderationLog` zostają z tombstone. Komentarze i posty zostają z `userId` wskazującym tombstone: wyświetlane jako „usunięty użytkownik”, bez linku i avatara.
- Tombstone w `users`: dokument zostaje z `nickname` (blokuje unikalny indeks, D37), `deletedAt`, bez `passwordHash` i `recoveryCodes`; logowanie i reset kodem odrzucane. Schemat: `User.deletedAt?: Date`, `passwordHash` opcjonalne; `authorize`, `recover-actions`, `findUserByNickname` (poza rejestracją, gdzie nick ma zostać zajęty) i wszystkie zapytania społeczności filtrują `deletedAt: { $exists: false }` (lub przez `hiddenUserIdsFor` z 69). `/p/<nick>` → 404. Wszystkie sesje usunięte (D75), wylogowanie.
- Zakładki i notatki (74): `readerMarks` konta kasowane po `userId` (indeks `{userId, storyId}`), znaczniki innych na jego tekstach – przez `purgeSocialData` (indeksy `{storyId}`, `{folderId}`).
- Kolejność: najpierw tombstone i sesje, potem sprzątanie w `after()` (znacznik `cleanupPendingAt`). Ponowienie: `after()` w `deleteAccount` i w layoucie `(protected)` przejmuje atomowo (`findOneAndUpdate` z `cleanupPendingAt < now-10 min` → `now`) jeden tombstone i dokańcza sprzątanie.
- Komentarze (76): komentarze konta po `userId` (indeks `{userId}`), dziś konta bez nicku/nieistniejące są przy odczycie pomijane (poza zaślepką usuniętego/ukrytego) – dostosować do „usunięty użytkownik”. Nowe kolekcje z `folderId` dopisywać też do `moveChapterSocialData` (`lib/social/cascade.ts`).
- Reakcje (77): reakcje konta kasowane po `userId` (unikalny indeks `{userId, targetType, targetId}`), reakcje innych na jego tekstach – przez `purgeSocialData` (indeksy `{folderId}`, `{storyId}`).
- Oceny (78): oceny konta kasowane po `userId` (unikalny indeks `{userId, targetType, targetId}`), oceny innych na jego tekstach – przez `purgeSocialData` (indeksy `{folderId}`, `{storyId}`).
- Moderacja (79): `communityModerators` i `communityBans` kasowane w obie strony (konto jako autor i jako moderator/zbanowany); `moderationLog` (poza `PURGES`) zostaje z tombstone zamiast danych konta.

## Kryteria akceptacji

1. Usunięcie wymaga poprawnego hasła i nicku; błędne hasła liczą się do limitu.
2. Po usunięciu nie da się zalogować ani zresetować hasła kodem; nick jest nie do zajęcia przy rejestracji.
3. Dane z listy znikają; komentarze i posty zostają jako „usunięty użytkownik”.
4. Sesje na innych urządzeniach przestają działać.
5. Przerwane sprzątanie kończy się przy kolejnej próbie.

## Testy

- Integracyjne: `tests/integration/account-deletion.test.ts` (1–5, sprawdzenie każdej kolekcji z listy; 5 przerywa sprzątanie wstrzykniętym błędem).
- E2E: `tests/e2e/account-deletion.spec.ts` (nowe konto rejestrowane w teście komentuje i usuwa konto; komentarz widoczny jako „usunięty użytkownik”; rejestracja tym nickiem odrzucona).
