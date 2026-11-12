# D74 – Zaufany adres klienta w limitach (2026-11-10)

Status: aktualna.

- Task 57, decyzje użytkownika. Na Vercelu adres klienta pochodzi tylko z `x-vercel-forwarded-for` (ustawia go platforma; według dokumentacji Vercela nadpisuje też `X-Forwarded-For`, ale ten nagłówek może zmienić proxy przed Vercelem). `X-Forwarded-For` jest ignorowany. Przy przeprowadzce poza Vercela zmienna `TRUSTED_IP_HEADER` wskazuje nagłówek proxy (używają jej też testy E2E). Pusta wartość nie wyłącza nagłówka Vercela.
- Bez zaufanego adresu (lokalnie, w testach, źle skonfigurowany hosting) limity po adresie są wyłączone, a w produkcji przy pierwszym takim żądaniu idzie ostrzeżenie do logów. Wspólny kubełek „unknown”, który pozwalał jednej osobie zablokować wszystkim logowanie, zniknął. Rejestracja i wyszukiwarka nie mają wtedy limitu.
- Limit logowania po koncie: 20 błędnych prób na godzinę na nick (bez rozróżniania wielkości liter), z dowolnych adresów, liczony także dla nicków bez konta (bez enumeracji). Po przekroczeniu blokuje także poprawne hasło do końca okna (najwyżej godzinę). Udane logowanie oddaje próbę.
- I1: rejestracja liczy limit przed sprawdzeniem, czy nick jest zajęty, więc zajęty nick też zużywa próbę (5 na godzinę z adresu). Komunikat „Za dużo prób rejestracji”. Próby odrzucone przez walidację nicku i hasła się nie liczą.
