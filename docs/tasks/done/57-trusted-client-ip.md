# 57 – Zaufany adres klienta w limitach

Z testów bezpieczeństwa 2026-11-07 ([F2](../../security/pentest-2026-11-07.md#f2--x-forwarded-for-w-rate-limitach-średnia--wysoka)).

## Zakres

- `clientIp` (`lib/rate-limit.ts`) nie może brać adresu z nagłówka ustawionego przez klienta. Adres tylko od zaufanego proxy: na Vercelu jego nagłówek, przy self-hostingu skonfigurowane proxy (liczba zaufanych hopów albo nagłówek ustawiany przez Caddy/Coolify).
- Brak zaufanego adresu nie może łączyć wszystkich klientów w jeden kubełek (`"unknown"`), który blokuje logowanie wszystkim.
- Dodatkowy limit logowania po koncie (nicku), niezależny od IP, z progiem, który nie pozwala łatwo zablokować cudzego konta.

Do decyzji przy starcie taska (nowa decyzja w `decisions.md`): skąd brać adres na Vercelu i przy self-hostingu (zmienna środowiskowa z trybem/liczbą hopów?), próg i okno limitu po koncie.

## Kryteria akceptacji

1. Zmiana `X-Forwarded-For` przez klienta nie omija limitu logowania, rejestracji ani wyszukiwarki.
2. Bez zaufanego adresu klienci nie dzielą jednego limitu.
3. Zgadywanie hasła jednego konta z wielu adresów jest ograniczone limitem po koncie.
4. Poprawne logowanie po wyczerpaniu limitu po koncie działa zgodnie z decyzją (np. po upływie okna).

## Testy

Unit: `clientIp` dla nagłówków z wieloma adresami i dla każdego trybu. Integracyjne: limit logowania z rotowanym `X-Forwarded-For`, limit po koncie. `manual`: na stagingu Vercel limit działa przy podrobionym `X-Forwarded-For`.

## Wynik (2026-11-10)

Decyzje: D74 (w tym I1 z raportu). `clientIp` i `takeIpAttempt` w `lib/rate-limit.ts`, limit po koncie `LOGIN_ACCOUNT_LIMIT` w `lib/auth/authorize.ts`, kolejność limitu w `register-actions.ts`. Zmienna `TRUSTED_IP_HEADER` w `.env.example` i `docs/deploy.md`.

Mapowanie kryteriów:
1. Zmiana `X-Forwarded-For` nie omija limitu logowania, rejestracji ani wyszukiwarki – `tests/integration/authorize.test.ts` („a changed X-Forwarded-For does not get around it”), `tests/integration/register.test.ts` („a changed X-Forwarded-For does not get around the limit”), E2E `tests/e2e/search.spec.ts` (inny XFF przy tym samym zaufanym adresie dalej daje „Too many searches”), unit `lib/rate-limit.test.ts` (XFF ignorowany w każdym trybie).
2. Bez zaufanego adresu klienci nie dzielą limitu – `lib/rate-limit.test.ts` („is null without a trusted address”), `authorize.test.ts` („without a trusted address”), `register.test.ts` („without a trusted address clients do not share one limit”).
3. Zgadywanie hasła jednego konta z wielu adresów – `authorize.test.ts` („stops guessing one account from many addresses…”, „counts a nickname without an account the same way”), E2E `tests/e2e/auth.spec.ts` (limit po koncie blokuje też poprawne hasło).
4. Poprawne logowanie po upływie okna – `authorize.test.ts` („lets the right password in again once the window has passed”).

`manual` (do zrobienia przez użytkownika na stagingu): po deployu kilka nieudanych logowań z `curl` i zmiennym `X-Forwarded-For` (np. `-H "X-Forwarded-For: 198.51.100.$i"`) do `/api/auth/callback/credentials`. Po 20 próbach z jednego prawdziwego adresu przychodzi `rate_limited`, a w logach Vercela nie ma ostrzeżenia o braku zaufanego adresu.
