# 57 – Zaufany adres klienta w limitach

Z testów bezpieczeństwa 2026-11-07 ([F2](../security/pentest-2026-11-07.md#f2--x-forwarded-for-w-rate-limitach-średnia--wysoka)).

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
