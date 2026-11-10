# 89 – Usuwanie konta

Subtask 68, zależy od 85 i 87. Podstawa: D80 (Konto). Zmienia D37 (konta nie dało się usunąć). Branch `feature/89-account-deletion` z `feature/social`, merge do `feature/social`.

## Zakres

- „Usuń konto” w dialogu ustawień: obecne hasło i wpisanie nicku; limit błędnych haseł jak `changePassword` (D75).
- Akcja `deleteAccount`: usuwa foldery, rozdziały, wersje, okładki, avatar, profil, ustawienia, słownik użytkownika, obserwacje (obie strony), bibliotekę i półki, postęp, zakładki i notatki, powiadomienia (własne i te, gdzie był jedynym aktorem), oceny, reakcje, DM (rozmowy i wiadomości obu stron rozmowy z tym kontem), blokady, bany i role moderatora, `readEvents`; `dailyStats` jego tekstów. Komentarze i posty zostają z `userId` wskazującym tombstone: wyświetlane jako „usunięty użytkownik”, bez linku i avatara.
- Tombstone w `users`: dokument zostaje z `nickname` (blokuje unikalny indeks, D37), `deletedAt`, bez `passwordHash` i `recoveryCodes`; logowanie i reset kodem odrzucane. `/p/<nick>` → 404. Wszystkie sesje usunięte (D75), wylogowanie.
- Kolejność: najpierw tombstone i sesje, potem sprzątanie w `after()`, ponawiane leniwie, jeśli przerwane (znacznik `cleanupPendingAt`).

## Kryteria akceptacji

1. Usunięcie wymaga poprawnego hasła i nicku; błędne hasła liczą się do limitu.
2. Po usunięciu nie da się zalogować ani zresetować hasła kodem; nick jest nie do zajęcia przy rejestracji.
3. Dane z listy znikają; komentarze i posty zostają jako „usunięty użytkownik”.
4. Sesje na innych urządzeniach przestają działać.
5. Przerwane sprzątanie kończy się przy kolejnej próbie.

## Testy

- Integracyjne: `tests/integration/account-deletion.test.ts` (1–5, sprawdzenie każdej kolekcji z listy).
- E2E: `tests/e2e/account-deletion.spec.ts` (nowe konto rejestrowane w teście komentuje i usuwa konto; komentarz widoczny jako „usunięty użytkownik”; rejestracja tym nickiem odrzucona).
