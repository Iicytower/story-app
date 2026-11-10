# 63 – Kody odzyskiwania konta

Powiązane z testami bezpieczeństwa 2026-11-07 (brak jakiejkolwiek ścieżki odzyskania konta). Konto to dziś tylko `nickname` + `passwordHash` (`lib/models/user.ts`), bez e-maila – zapomniane hasło oznacza trwałą utratę konta i wszystkich opowiadań. Kody odzyskiwania dają jedyną realną drogę powrotu bez wprowadzania e-maila.

## Zakres

- Generowanie zestawu jednorazowych kodów odzyskiwania (np. 8–10 kodów) przy rejestracji lub na żądanie w ustawieniach konta. Kody pokazywane użytkownikowi **raz** (do zapisania/wydruku), w bazie tylko ich hash (jak hasło: bcrypt z prehashem SHA-256 albo osobny szybki hash – do decyzji).
- Pole na koncie: `recoveryCodes: { hash: string, usedAt: Date | null }[]` w `User` + migracja (`migrations/`, D14). Istniejące konta bez kodów: przy pierwszym logowaniu lub w ustawieniach prośba o wygenerowanie.
- Ekran „Nie pamiętam hasła": użytkownik podaje nick + jeden nieużyty kod odzyskiwania → ustawia nowe hasło (walidacja przez `passwordError`). Kod zostaje oznaczony `usedAt` i nie da się go użyć ponownie.
- Limit prób podania kodu po nicku i po IP (jak `LoginRateLimited`, z uwzględnieniem naprawy z taska 57), stały czas odpowiedzi i brak ujawniania, czy nick istnieje (jak logowanie).
- Zarządzanie w ustawieniach: ile kodów zostało, regeneracja (unieważnia stare), wszystko za potwierdzeniem obecnym hasłem.
- Teksty w `messages/en.json` i `messages/pl.json` (D46).

Zależności i kolejność: użycie kodu resetuje hasło, więc powinno unieważnić wszystkie istniejące sesje – spójne z taskiem [58](58-session-revocation.md); najlepiej realizować po nim albo razem. Jeśli powstanie opcjonalne 2FA (TOTP), te same kody mogą służyć do obejścia 2FA przy utracie telefonu – zaprojektować pole tak, żeby dało się to później dołożyć bez migracji.

Do decyzji przy starcie taska (nowa decyzja w `decisions.md`): liczba i format kodów, algorytm hashowania kodów, czy generować obowiązkowo przy rejestracji czy opcjonalnie, zachowanie dla kont sprzed migracji, czy reset hasła kodem wymusza wylogowanie wszędzie (zależne od 58).

## Kryteria akceptacji

1. Użytkownik może wygenerować kody odzyskiwania i zobaczyć je raz; w bazie przechowywany jest tylko hash.
2. Podanie nicku i nieużytego kodu pozwala ustawić nowe hasło; ten sam kod użyty drugi raz jest odrzucany.
3. Błędny kod, kod już użyty i nieistniejący nick zwracają ten sam ogólny błąd (bez enumeracji), a nadmiar prób → `RATE_LIMITED`.
4. Nowe hasło przechodzi pełną walidację `passwordError`; po resecie użytkownik loguje się nowym hasłem, a stare nie działa.
5. Regeneracja kodów unieważnia poprzedni zestaw.

## Testy

Unit: hash i weryfikacja kodu, oznaczanie `usedAt`, odrzucenie zużytego. Integracyjne: pełny reset hasła kodem, limit prób, brak enumeracji nicku, regeneracja. E2E: ścieżka „nie pamiętam hasła" – wygenerowanie kodów, reset, logowanie nowym hasłem.

## Wynik (2026-11-10)

Decyzje: D76. Zmiany względem zakresu z decyzji użytkownika: kody tylko przy rejestracji (bez generowania w ustawieniach i bez prośby dla starych kont); nowy zestaw przychodzi automatycznie po każdym resecie kodem. Kod: `lib/auth/recovery-codes.ts`, `app/[locale]/auth/recover-actions.ts`, `recover-form.tsx`, `recovery-codes-view.tsx`, `auth-dialog.tsx`, kody w `register-actions.ts`, pole w `lib/models/user.ts`.

Mapowanie kryteriów:
1. Kody generowane i pokazane raz, w bazie tylko hash – `tests/integration/recovery.test.ts` („returns ten codes once and stores only their hashes”: dokument użytkownika nie zawiera kodu w żadnej postaci), `lib/auth/recovery-codes.test.ts`, E2E `tests/e2e/register.spec.ts` (okno z 10 kodami nie zamyka się Escape, „Dalej” aktywne dopiero po zaznaczeniu).
2. Nick + nieużyty kod ustawia nowe hasło; ten sam kod drugi raz odrzucony – `recovery.test.ts` („sets a new password with an unused code, and the code works only once”), E2E `tests/e2e/recovery.spec.ts`.
3. Błędny kod, użyty kod i nieistniejący nick dają ten sam błąd; nadmiar prób → `RATE_LIMITED` – `recovery.test.ts` („…get the same answer”, „refuses more than five wrong codes for one nickname”).
4. Nowe hasło przechodzi `passwordError`; po resecie działa nowe hasło, stare nie – `recovery.test.ts` („checks the new password fully…”, „sets a new password…”), E2E `recovery.spec.ts` (stare hasło: „Invalid nickname or password.”, nowe loguje).
5. Regeneracja unieważnia poprzedni zestaw – według decyzji użytkownika jako nowy zestaw po resecie: `recovery.test.ts` („gives a new set of codes that replaces the old one”), E2E (nowe kody różne od starych).

Dodatkowo: reset kończy wszystkie sesje konta (`recovery.test.ts`, „ends every session of the account”).
